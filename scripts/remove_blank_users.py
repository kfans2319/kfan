#!/usr/bin/env python3
"""
Remove Blank Users Script

This script safely removes blank users from the database.
Blank users are defined as users with no posts, no avatar, and no bio.

Usage:
python scripts/remove_blank_users.py [--dry-run] [--limit NUMBER] [--batch-size NUMBER]

Options:
  --dry-run          Run the script without actually deleting users (default: false)
  --limit NUMBER     Limit the number of users to delete (default: no limit)
  --batch-size NUMBER  Number of users to process in each batch (default: 100)
"""

import os
import sys
import json
import time
import argparse
import subprocess
from typing import Dict, Any, List, Optional


# Maximum number of retry attempts for database operations
MAX_RETRIES = 3
# Small delay between retries (in milliseconds)
RETRY_DELAY = 1000


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Remove blank users from the database')
    parser.add_argument('--dry-run', action='store_true', help='Run without actually deleting users')
    parser.add_argument('--limit', type=int, help='Limit the number of users to delete')
    parser.add_argument('--batch-size', type=int, default=100, help='Number of users to process in each batch')
    return parser.parse_args()


def run_prisma_script(script: str, retries: int = MAX_RETRIES) -> Optional[Dict[str, Any]]:
    """
    Run a Prisma script using Node with retries
    
    Args:
        script: Prisma script as string
        retries: Number of retry attempts
        
    Returns:
        JSON result or None if error
    """
    attempt = 0
    while attempt <= retries:
        try:
            # Create a temporary file for the script
            script_path = 'temp_prisma_script.js'
            with open(script_path, 'w') as f:
                f.write(script)
            
            # Run the script with Node
            result = subprocess.run(
                ['node', script_path],
                capture_output=True,
                text=True,
                check=True
            )
            
            # Delete the temporary file
            os.remove(script_path)
            
            # Parse and return the JSON output
            if result.stdout:
                try:
                    return json.loads(result.stdout)
                except json.JSONDecodeError:
                    print(f"Warning: Could not parse JSON output: {result.stdout}")
                    return None
            return None
        except subprocess.CalledProcessError as e:
            attempt += 1
            print(f"Error running Prisma script (attempt {attempt}/{retries}): {e}")
            print(f"Stderr: {e.stderr}")
            if attempt <= retries:
                print(f"Retrying in {RETRY_DELAY/1000} seconds...")
                time.sleep(RETRY_DELAY/1000)
            else:
                return None
        except Exception as e:
            attempt += 1
            print(f"Unexpected error (attempt {attempt}/{retries}): {e}")
            if attempt <= retries:
                print(f"Retrying in {RETRY_DELAY/1000} seconds...")
                time.sleep(RETRY_DELAY/1000)
            else:
                return None
        finally:
            # Ensure temp file is deleted
            if os.path.exists('temp_prisma_script.js'):
                try:
                    os.remove('temp_prisma_script.js')
                except:
                    pass


def find_blank_users(skip: int, take: int) -> List[Dict[str, Any]]:
    """
    Find blank users
    
    Args:
        skip: Number of users to skip
        take: Number of users to take
        
    Returns:
        List of blank user objects
    """
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function findBlankUsers() {{
        try {{
            const blankUsers = await prisma.user.findMany({{
                where: {{
                    posts: {{
                        none: {{}}
                    }},
                    avatarUrl: null,
                    OR: [
                        {{ bio: null }},
                        {{ bio: "" }}
                    ]
                }},
                select: {{
                    id: true,
                    username: true,
                    displayName: true,
                    createdAt: true
                }},
                skip: {skip},
                take: {take}
            }});
            console.log(JSON.stringify({{ users: blankUsers }}));
        }} catch (error) {{
            console.error('Error finding blank users:', error);
            console.log(JSON.stringify({{ error: error.message }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    findBlankUsers();
    """
    
    result = run_prisma_script(script)
    users = result.get('users', []) if result else []
    return users


def count_blank_users() -> int:
    """
    Count total blank users
    
    Returns:
        Count of blank users
    """
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      log: ['error', 'warn']
    });
    
    async function countBlankUsers() {
        try {
            const count = await prisma.user.count({
                where: {
                    posts: {
                        none: {}
                    },
                    avatarUrl: null,
                    OR: [
                        { bio: null },
                        { bio: "" }
                    ]
                }
            });
            console.log(JSON.stringify({ count }));
        } catch (error) {
            console.error('Error counting blank users:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countBlankUsers();
    """
    
    result = run_prisma_script(script)
    count = result.get('count', 0) if result else 0
    return count


def delete_related_data(user_id: str, dry_run: bool) -> bool:
    """
    Delete related data for a user with separate operations
    
    Args:
        user_id: User ID to delete related data for
        dry_run: If True, don't actually delete
        
    Returns:
        Success status
    """
    if dry_run:
        # Dry run, don't actually delete
        return True
    
    # Delete follows
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteFollows() {{
        try {{
            await prisma.follow.deleteMany({{
                where: {{
                    OR: [
                        {{ followerId: "{user_id}" }},
                        {{ followingId: "{user_id}" }}
                    ]
                }}
            }});
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting follows:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteFollows();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete follows for user {user_id}")
    
    time.sleep(0.01)  # Small delay
    
    # Delete likes
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteLikes() {{
        try {{
            await prisma.like.deleteMany({{
                where: {{ userId: "{user_id}" }}
            }});
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting likes:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteLikes();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete likes for user {user_id}")
    
    time.sleep(0.01)  # Small delay
    
    # Delete bookmarks
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteBookmarks() {{
        try {{
            await prisma.bookmark.deleteMany({{
                where: {{ userId: "{user_id}" }}
            }});
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting bookmarks:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteBookmarks();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete bookmarks for user {user_id}")
        
    time.sleep(0.01)  # Small delay
    
    # Delete comments
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteComments() {{
        try {{
            await prisma.comment.deleteMany({{
                where: {{ userId: "{user_id}" }}
            }});
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting comments:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteComments();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete comments for user {user_id}")
    
    time.sleep(0.01)  # Small delay
    
    # Find post IDs and delete attachments
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteAttachments() {{
        try {{
            const userPosts = await prisma.post.findMany({{
                where: {{ userId: "{user_id}" }},
                select: {{ id: true }}
            }});
            
            if (userPosts.length > 0) {{
                const postIds = userPosts.map(post => post.id);
                
                await prisma.attachment.deleteMany({{
                    where: {{
                        postId: {{
                            in: postIds
                        }}
                    }}
                }});
            }}
            
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting attachments:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteAttachments();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete attachments for user {user_id}")
    
    time.sleep(0.01)  # Small delay
    
    # Delete posts
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deletePosts() {{
        try {{
            await prisma.post.deleteMany({{
                where: {{ userId: "{user_id}" }}
            }});
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting posts:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deletePosts();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete posts for user {user_id}")
    
    time.sleep(0.01)  # Small delay
    
    # Check for subscription tiers and delete related subscriptions
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteTiersAndSubscriptions() {{
        try {{
            // Check for tiers
            const userTiers = await prisma.subscriptionTier.findMany({{
                where: {{ creatorId: "{user_id}" }},
                select: {{ id: true }}
            }});
            
            if (userTiers.length > 0) {{
                const tierIds = userTiers.map(tier => tier.id);
                
                // Delete tier subscriptions
                await prisma.subscription.deleteMany({{
                    where: {{
                        tierId: {{
                            in: tierIds
                        }}
                    }}
                }});
                
                // Delete tiers
                await prisma.subscriptionTier.deleteMany({{
                    where: {{ creatorId: "{user_id}" }}
                }});
            }}
            
            // Delete user's subscriptions
            await prisma.subscription.deleteMany({{
                where: {{ subscriberId: "{user_id}" }}
            }});
            
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting tiers and subscriptions:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteTiersAndSubscriptions();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete tiers and subscriptions for user {user_id}")
    
    time.sleep(0.01)  # Small delay
    
    # Delete metadata records
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteMetadata() {{
        try {{
            try {{
                await prisma.$executeRaw`DELETE FROM "_followmeta" WHERE userid = ${{"{user_id}"}}`;
            }} catch (error) {{
                // Ignore if table doesn't exist
                if (!error.message.includes('relation "_followmeta" does not exist')) {{
                    throw error;
                }}
            }}
            
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error('Error deleting metadata:', error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteMetadata();
    """
    
    result = run_prisma_script(script)
    if not result or not result.get('success', False):
        print(f"Warning: Failed to delete metadata for user {user_id}")
    
    return True


def delete_user_record(user_id: str, dry_run: bool) -> bool:
    """
    Delete a user record after related data has been deleted
    
    Args:
        user_id: User ID to delete
        dry_run: If True, don't actually delete
        
    Returns:
        Success status
    """
    if dry_run:
        # Dry run, don't actually delete
        return True
    
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient({{
      log: ['error', 'warn']
    }});
    
    async function deleteUser() {{
        try {{
            await prisma.user.delete({{
                where: {{ id: "{user_id}" }}
            }});
            
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error(`Error deleting user {user_id}:`, error);
            console.log(JSON.stringify({{ error: error.message, success: false }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    deleteUser();
    """
    
    # Try multiple times with retries
    for attempt in range(MAX_RETRIES + 1):
        result = run_prisma_script(script)
        if result and result.get('success', False):
            return True
        
        if attempt < MAX_RETRIES:
            print(f"Retrying user deletion (attempt {attempt+1}/{MAX_RETRIES})...")
            time.sleep(RETRY_DELAY/1000)
    
    return False


def delete_user(user_id: str, dry_run: bool) -> bool:
    """
    Delete a user and all related data
    
    Args:
        user_id: User ID to delete
        dry_run: If True, don't actually delete
        
    Returns:
        Success status
    """
    if dry_run:
        # Dry run, don't actually delete
        return True
    
    # First delete all related data
    related_data_deleted = delete_related_data(user_id, dry_run)
    
    if not related_data_deleted:
        print(f"Warning: Could not delete all related data for user {user_id}")
        # Continue anyway to try deleting the user
    
    # Then delete the user record
    user_deleted = delete_user_record(user_id, dry_run)
    
    return user_deleted


def remove_blank_users(dry_run: bool, limit: Optional[int], batch_size: int):
    """
    Main function to remove blank users
    
    Args:
        dry_run: If True, don't actually delete users
        limit: Maximum number of users to delete (None for no limit)
        batch_size: Number of users to process in each batch
    """
    print('=' * 47)
    print('           BLANK USER REMOVAL TOOL            ')
    print('=' * 47)
    print()
    
    if dry_run:
        print('DRY RUN MODE: No users will actually be deleted\n')
    
    if limit:
        print(f'User deletion limited to {limit:,} users\n')
    
    try:
        # Count total blank users
        total_blank_users = count_blank_users()
        print(f'Found {total_blank_users:,} blank users in the database')
        
        if total_blank_users == 0:
            print('No blank users to remove. Exiting.')
            return
        
        # Calculate how many users to process
        users_to_process = min(limit, total_blank_users) if limit else total_blank_users
        print(f'Will process {users_to_process:,} blank users in batches of {batch_size}')
        
        # Confirm before proceeding
        if not dry_run:
            print(f'\n⚠️  WARNING: This will permanently delete {users_to_process:,} users and all their related data!')
            print('Run with --dry-run to test without deleting.\n')
            # In a real application, you would add user confirmation here
        
        # Process users in batches
        processed_count = 0
        deleted_count = 0
        skip = 0
        batch_num = 0
        
        print('\nStarting user processing...')
        
        while processed_count < users_to_process:
            batch_num += 1
            
            # Calculate batch size for this iteration
            current_batch_size = min(batch_size, users_to_process - processed_count)
            
            # Get a batch of blank users
            users = find_blank_users(skip, current_batch_size)
            
            if not users:
                print('No more blank users found. Exiting.')
                break
            
            print(f'\nProcessing batch {batch_num} ({len(users)} users)...')
            
            # Process each user in the batch
            batch_deleted_count = 0
            
            for user in users:
                processed_count += 1
                
                # Log user info
                display_name = user.get('displayName') or user.get('username')
                user_desc = f"User: {display_name} ({user.get('id')})"
                
                # Delete the user
                success = delete_user(user.get('id'), dry_run)
                
                if success:
                    deleted_count += 1
                    batch_deleted_count += 1
                    print(f"✅ [{processed_count}/{users_to_process}] Deleted {user_desc}")
                else:
                    print(f"❌ [{processed_count}/{users_to_process}] Failed to delete {user_desc}")
                
                # Add a small delay to avoid overwhelming the database
                time.sleep(0.1)
            
            # Log batch results
            percent_complete = (processed_count / users_to_process) * 100
            print(f'\nBatch {batch_num} complete: Deleted {batch_deleted_count}/{len(users)} users')
            print(f'Progress: {processed_count:,}/{users_to_process:,} users ({percent_complete:.2f}%)')
            
            # Update skip value for next batch
            skip += len(users)
            
            # Add a small delay between batches
            time.sleep(1.0)
        
        # Log final results
        print('\n' + '=' * 47)
        print('               REMOVAL COMPLETE                ')
        print('=' * 47)
        print(f'Processed: {processed_count:,} users')
        print(f'{"Would have deleted" if dry_run else "Deleted"}: {deleted_count:,} users')
        print(f'Remaining blank users: {(total_blank_users - deleted_count):,}')
        
    except Exception as e:
        print(f'Error removing blank users: {e}')


def main():
    """Main entry point"""
    args = parse_args()
    remove_blank_users(args.dry_run, args.limit, args.batch_size)


if __name__ == "__main__":
    main() 