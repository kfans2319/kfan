#!/usr/bin/env python3
"""
Follow and Like Script

This script performs two main operations with reasonable numbers:
1. Makes existing blank users follow users with posts (50-100 followers)
2. Makes existing blank users like posts from content creators (30-100 likes)

This version uses moderate numbers that won't overwhelm the database.
"""

import os
import json
import uuid
import time
import random
import subprocess
import traceback
from datetime import datetime

# Configuration - moderate numbers that won't overwhelm database
MIN_FOLLOWERS_PER_CREATOR = 50   # Minimum followers per user
MAX_FOLLOWERS_PER_CREATOR = 100  # Maximum followers per user 
MIN_LIKES_PER_POST = 30          # Minimum likes per post
MAX_LIKES_PER_POST = 100         # Maximum likes per post
BATCH_SIZE = 100                 # Process in smaller batches to reduce DB load

def run_prisma_script(script):
    """Execute a script with Prisma client using Node.js"""
    # Create a temporary file with the script
    script_path = os.path.join(os.getcwd(), 'scripts', f"temp_{uuid.uuid4()}.js")
    
    # Add Prisma client imports and initialization with logging
    full_script = f"""
const {{ PrismaClient, Prisma }} = require('@prisma/client');
const prisma = new PrismaClient({{
  log: [
    {{ level: 'warn', emit: 'stdout' }},
    {{ level: 'error', emit: 'stdout' }}
  ],
}});

async function main() {{
  try {{
    {script}
  }} catch (error) {{
    console.error('Error:', error);
    return {{ error: error.message, stack: error.stack }};
  }} finally {{
    await prisma.$disconnect();
  }}
}}

main().then(result => {{
  console.log(JSON.stringify(result));
  process.exit(0);
}}).catch(error => {{
  console.error('Fatal error:', error);
  process.exit(1);
}});
"""
    
    with open(script_path, 'w') as f:
        f.write(full_script)
    
    try:
        # Run the script and capture the output
        result = subprocess.run(['node', script_path], 
                               capture_output=True, 
                               text=True, 
                               check=True)
        
        # Parse the JSON output
        if result.stdout.strip():
            try:
                return json.loads(result.stdout.strip())
            except json.JSONDecodeError:
                print(f"Warning: Could not parse JSON output: {result.stdout}")
                return None
        return None
    except subprocess.CalledProcessError as e:
        print(f"Error executing Prisma script: {e}")
        print(f"Script output: {e.stdout}")
        print(f"Script error: {e.stderr}")
        raise
    finally:
        # Clean up the temporary script
        if os.path.exists(script_path):
            os.remove(script_path)

def validate_prisma_models():
    """Validate that all required Prisma models exist"""
    script = """
    async function checkModels() {
      const result = {
        user: false,
        follow: false,
        like: false,
        post: false
      };
      
      // Check if User model is available and working
      try {
        const userCount = await prisma.user.count({ take: 1 });
        result.user = true;
      } catch (e) {
        console.error('Error checking User model:', e.message);
      }
      
      // Helper function to check models
      const safeCheck = async (model) => {
        try {
          if (!prisma[model]) return false;
          await prisma[model].count({ take: 1 });
          return true;
        } catch (e) {
          console.error(`Error checking ${model} model:`, e.message);
          return false;
        }
      };
      
      // Check all other models
      result.follow = await safeCheck('follow');
      result.like = await safeCheck('like');
      result.post = await safeCheck('post');
      
      return result;
    }
    
    return checkModels();
    """
    
    try:
        model_status = run_prisma_script(script)
        
        if not model_status or isinstance(model_status, dict) and 'error' in model_status:
            print(f"Error validating models: {model_status.get('error') if model_status else 'Unknown error'}")
            return False
        
        print(f"Model validation results:")
        print(f"- User model: {'Available' if model_status.get('user') else 'Not available'}")
        print(f"- Follow model: {'Available' if model_status.get('follow') else 'Not available'}")
        print(f"- Like model: {'Available' if model_status.get('like') else 'Not available'}")
        print(f"- Post model: {'Available' if model_status.get('post') else 'Not available'}")
        
        if not model_status.get('user') or not model_status.get('follow') or not model_status.get('like') or not model_status.get('post'):
            print("One or more critical models are not available - cannot proceed")
            return False
            
        return True
    except Exception as e:
        print(f"Error validating Prisma models: {e}")
        print(traceback.format_exc())
        return False

def get_blank_users(limit=10000):
    """Get all blank users (users without posts)"""
    print(f"Finding blank users (up to {limit:,})...")
    
    script = f"""
    const blankUsers = await prisma.user.findMany({{
      where: {{
        posts: {{
          none: {{}}
        }}
      }},
      select: {{
        id: true
      }},
      take: {limit}
    }});
    
    return blankUsers.map(user => user.id);
    """
    
    try:
        user_ids = run_prisma_script(script)
        if isinstance(user_ids, dict) and 'error' in user_ids:
            print(f"Error finding blank users: {user_ids['error']}")
            return []
            
        print(f"Found {len(user_ids):,} blank users")
        return user_ids
    except Exception as e:
        print(f"Error finding blank users: {e}")
        print(traceback.format_exc())
        return []

def get_users_with_posts():
    """Get all users with posts"""
    print("Finding users with posts...")
    
    script = """
    const usersWithPosts = await prisma.user.findMany({
      where: {
        posts: {
          some: {}
        }
      },
      select: {
        id: true,
        username: true,
        _count: {
          select: {
            posts: true,
            followers: true
          }
        }
      }
    });
    
    return usersWithPosts;
    """
    
    try:
        users = run_prisma_script(script)
        if isinstance(users, dict) and 'error' in users:
            print(f"Error finding users with posts: {users['error']}")
            return []
            
        print(f"Found {len(users)} users with posts")
        return users
    except Exception as e:
        print(f"Error finding users with posts: {e}")
        print(traceback.format_exc())
        return []

def get_user_posts(user_id):
    """Get all posts from a specific user"""
    script = f"""
    const posts = await prisma.post.findMany({{
      where: {{
        userId: "{user_id}"
      }},
      select: {{
        id: true,
        _count: {{
          select: {{
            likes: true
          }}
        }}
      }}
    }});
    
    return posts;
    """
    
    try:
        posts = run_prisma_script(script)
        if isinstance(posts, dict) and 'error' in posts:
            print(f"Error getting posts for user {user_id}: {posts['error']}")
            return []
            
        return posts
    except Exception as e:
        print(f"Error getting posts for user {user_id}: {e}")
        print(traceback.format_exc())
        return []

def get_existing_followers(user_id):
    """Get existing followers for a user"""
    script = f"""
    // Count existing followers
    const followerCount = await prisma.follow.count({{
      where: {{
        followingId: "{user_id}"
      }}
    }});
    
    // Get follower IDs
    const followers = await prisma.follow.findMany({{
      where: {{
        followingId: "{user_id}"
      }},
      select: {{
        followerId: true
      }}
    }});
    
    return {{
      count: followerCount,
      ids: followers.map(f => f.followerId)
    }};
    """
    
    try:
        result = run_prisma_script(script)
        if isinstance(result, dict) and 'error' in result:
            print(f"Error getting existing followers for user {user_id}: {result['error']}")
            return {"count": 0, "ids": []}
            
        if result:
            return result
        return {"count": 0, "ids": []}
    except Exception as e:
        print(f"Error getting existing followers for user {user_id}: {e}")
        print(traceback.format_exc())
        return {"count": 0, "ids": []}

def get_existing_likes(post_id):
    """Get existing likes for a post"""
    script = f"""
    // Count existing likes
    const likeCount = await prisma.like.count({{
      where: {{
        postId: "{post_id}"
      }}
    }});
    
    // Get liker IDs
    const likers = await prisma.like.findMany({{
      where: {{
        postId: "{post_id}"
      }},
      select: {{
        userId: true
      }}
    }});
    
    return {{
      count: likeCount,
      ids: likers.map(l => l.userId)
    }};
    """
    
    try:
        result = run_prisma_script(script)
        if isinstance(result, dict) and 'error' in result:
            print(f"Error getting existing likes for post {post_id}: {result['error']}")
            return {"count": 0, "ids": []}
            
        if result:
            return result
        return {"count": 0, "ids": []}
    except Exception as e:
        print(f"Error getting existing likes for post {post_id}: {e}")
        print(traceback.format_exc())
        return {"count": 0, "ids": []}

def create_follows_for_user(target_user_id, desired_follower_count, blank_user_ids):
    """Create follows for a user"""
    print(f"Creating follows for user {target_user_id}...")
    
    try:
        # Check existing followers
        existing_followers = get_existing_followers(target_user_id)
        existing_follower_count = existing_followers["count"]
        existing_follower_ids = existing_followers["ids"]
        
        print(f"User already has {existing_follower_count:,} followers")
        
        # Calculate how many more followers needed
        additional_followers_needed = max(0, desired_follower_count - existing_follower_count)
        
        if additional_followers_needed <= 0:
            print(f"User {target_user_id} already has enough followers. Skipping.")
            return existing_follower_count
        
        print(f"Need to add {additional_followers_needed:,} more followers")
        
        # Convert to set for faster lookups
        existing_follower_id_set = set([f["followerId"] for f in existing_follower_ids])
        
        # Filter out users who are already following
        available_followers = [id for id in blank_user_ids if id not in existing_follower_id_set]
        
        if not available_followers:
            print(f"No available users to create followers for user {target_user_id}")
            return existing_follower_count
        
        # Randomly select users to be followers
        selected_users = random.sample(
            available_followers, 
            min(additional_followers_needed, len(available_followers))
        )
        
        print(f"Selected {len(selected_users):,} users to become followers")
        
        # Process in batches
        created_follows = 0
        
        for i in range(0, len(selected_users), BATCH_SIZE):
            current_batch = selected_users[i:i+BATCH_SIZE]
            
            # Create follows in batch
            follows_data = [{"followerId": follower_id, "followingId": target_user_id} 
                           for follower_id in current_batch]
            
            batch_script = f"""
            const followsData = {json.dumps(follows_data)};
            
            const result = await prisma.follow.createMany({{
              data: followsData,
              skipDuplicates: true
            }});
            
            return result.count;
            """
            
            try:
                result = run_prisma_script(batch_script)
                if isinstance(result, dict) and 'error' in result:
                    print(f"Error creating follows batch: {result['error']}")
                    continue
                    
                if result:
                    created_follows += result
                    print(f"Created {created_follows:,}/{len(selected_users):,} follows for user {target_user_id}")
            except Exception as e:
                print(f"Error creating follows batch: {e}")
                print(traceback.format_exc())
            
            # Add a small delay between batches
            if i + BATCH_SIZE < len(selected_users):
                time.sleep(0.5)
        
        total_followers = existing_follower_count + created_follows
        print(f"Finished creating follows. User {target_user_id} now has {total_followers:,} followers")
        
        # Update follower count in metadata table
        update_follower_count_metadata(target_user_id, total_followers)
        
        return total_followers
    except Exception as e:
        print(f"Error creating follows for user {target_user_id}: {e}")
        print(traceback.format_exc())
        return 0

def create_likes_for_post(post_id, desired_like_count, blank_user_ids):
    """Create likes for a post"""
    print(f"Creating likes for post {post_id}...")
    
    try:
        # Check existing likes
        existing_likes = get_existing_likes(post_id)
        existing_like_count = existing_likes["count"]
        existing_liker_ids = existing_likes["ids"]
        
        print(f"Post already has {existing_like_count:,} likes")
        
        # Calculate how many more likes needed
        additional_likes_needed = max(0, desired_like_count - existing_like_count)
        
        if additional_likes_needed <= 0:
            print(f"Post {post_id} already has enough likes. Skipping.")
            return existing_like_count
        
        print(f"Need to add {additional_likes_needed:,} more likes")
        
        # Convert to set for faster lookups
        existing_liker_id_set = set([l["userId"] for l in existing_liker_ids])
        
        # Filter out users who already liked the post
        available_likers = [id for id in blank_user_ids if id not in existing_liker_id_set]
        
        if not available_likers:
            print(f"No available users to create likes for post {post_id}")
            return existing_like_count
        
        # Randomly select users to be likers
        selected_users = random.sample(
            available_likers, 
            min(additional_likes_needed, len(available_likers))
        )
        
        print(f"Selected {len(selected_users):,} users to like the post")
        
        # Process in batches
        created_likes = 0
        
        for i in range(0, len(selected_users), BATCH_SIZE):
            current_batch = selected_users[i:i+BATCH_SIZE]
            
            # Create likes in batch
            likes_data = [{"userId": user_id, "postId": post_id} 
                         for user_id in current_batch]
            
            batch_script = f"""
            const likesData = {json.dumps(likes_data)};
            
            const result = await prisma.like.createMany({{
              data: likesData,
              skipDuplicates: true
            }});
            
            return result.count;
            """
            
            try:
                result = run_prisma_script(batch_script)
                if isinstance(result, dict) and 'error' in result:
                    print(f"Error creating likes batch: {result['error']}")
                    continue
                    
                if result:
                    created_likes += result
                    print(f"Created {created_likes:,}/{len(selected_users):,} likes for post {post_id}")
            except Exception as e:
                print(f"Error creating likes batch: {e}")
                print(traceback.format_exc())
            
            # Add a small delay between batches
            if i + BATCH_SIZE < len(selected_users):
                time.sleep(0.3)
        
        total_likes = existing_like_count + created_likes
        print(f"Finished creating likes. Post {post_id} now has {total_likes:,} likes")
        
        return total_likes
    except Exception as e:
        print(f"Error creating likes for post {post_id}: {e}")
        print(traceback.format_exc())
        return 0

def create_likes_for_user_posts(user_id, blank_user_ids):
    """Create likes for all posts of a user"""
    print(f"Creating likes for all posts of user {user_id}...")
    
    try:
        # Get all posts for this user
        posts = get_user_posts(user_id)
        
        if not posts:
            print(f"No posts found for user {user_id}. Skipping like creation.")
            return 0
        
        print(f"Found {len(posts)} posts for user {user_id}")
        
        total_likes_created = 0
        
        # Process each post
        for post in posts:
            post_id = post["id"]
            # Random number of likes for this post
            like_count = random.randint(MIN_LIKES_PER_POST, MAX_LIKES_PER_POST)
            
            # Create likes for this post
            likes_created = create_likes_for_post(post_id, like_count, blank_user_ids)
            total_likes_created += likes_created
            
            # Add a short delay between posts
            time.sleep(0.5)
        
        print(f"Finished creating {total_likes_created:,} likes for user {user_id}'s posts")
        return total_likes_created
    except Exception as e:
        print(f"Error creating likes for user {user_id}'s posts: {e}")
        print(traceback.format_exc())
        return 0

def update_follower_count_metadata(user_id, follower_count):
    """Update follower counts in the metadata table"""
    script = f"""
    try {{
        // Try to create the metadata table if it doesn't exist
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS _followmeta (
                userid TEXT PRIMARY KEY,
                followercount INTEGER NOT NULL,
                createdat TIMESTAMP NOT NULL,
                updatedat TIMESTAMP NOT NULL
            )
        `;
        
        // Insert or update the follower count
        await prisma.$executeRaw`
            INSERT INTO _followmeta (userid, followercount, createdat, updatedat)
            VALUES ('{user_id}', {follower_count}, NOW(), NOW())
            ON CONFLICT (userid) 
            DO UPDATE SET followercount = {follower_count}, updatedat = NOW()
        `;
        
        return {{ success: true }};
    }} catch (e) {{
        console.error("Error updating follower count metadata:", e);
        return {{ success: false, error: e.message }};
    }}
    """
    
    try:
        result = run_prisma_script(script)
        if result and result.get('success'):
            print(f"Updated follower count metadata for user {user_id} to {follower_count:,}")
            return True
        else:
            print(f"Failed to update follower count metadata: {result.get('error') if result else 'Unknown error'}")
            return False
    except Exception as e:
        print(f"Error updating follower count metadata for user {user_id}: {e}")
        print(traceback.format_exc())
        return False

def main():
    """Main function to run the script"""
    print("Starting follow and like process with reasonable numbers...")
    print(f"Users will have {MIN_FOLLOWERS_PER_CREATOR}-{MAX_FOLLOWERS_PER_CREATOR} followers")
    print(f"Posts will have {MIN_LIKES_PER_POST}-{MAX_LIKES_PER_POST} likes")
    
    try:
        # Validate that models exist
        if not validate_prisma_models():
            print("Cannot proceed due to issues with database models")
            return
            
        # Get users with posts (content creators)
        users_with_posts = get_users_with_posts()
        
        if not users_with_posts:
            print("No users with posts found. Cannot proceed.")
            return
        
        print(f"Found {len(users_with_posts)} users with posts who will receive followers and likes")
        
        # Get blank users (users without posts)
        blank_user_ids = get_blank_users()
        
        if not blank_user_ids:
            print("No blank users found. Cannot proceed.")
            return
        
        print(f"Will use {len(blank_user_ids):,} blank users as followers and likers")
        
        # Process each content creator
        for user in users_with_posts:
            user_id = user["id"]
            username = user["username"]
            post_count = user["_count"]["posts"]
            follower_count = user["_count"]["followers"]
            
            print(f"\n======= Processing user {username} ({user_id}) =======")
            print(f"User has {post_count} posts and {follower_count} followers")
            
            # Generate a random follower count for this user
            desired_follower_count = random.randint(MIN_FOLLOWERS_PER_CREATOR, MAX_FOLLOWERS_PER_CREATOR)
            
            try:
                # Create follows
                create_follows_for_user(user_id, desired_follower_count, blank_user_ids)
            except Exception as e:
                print(f"Failed to create follows for user {user_id}: {e}")
                print(traceback.format_exc())
                print("Continuing with likes creation...")
            
            try:
                # Create likes for all posts
                create_likes_for_user_posts(user_id, blank_user_ids)
            except Exception as e:
                print(f"Failed to create likes for user {user_id}: {e}")
                print(traceback.format_exc())
            
            # Small delay between processing users
            time.sleep(1)
        
        print("\n----------------------------------------")
        print("Follow and like process completed")
        print("----------------------------------------")
        print(f"Processed {len(users_with_posts)} content creators")
        print(f"Each user now has {MIN_FOLLOWERS_PER_CREATOR}-{MAX_FOLLOWERS_PER_CREATOR} followers")
        print(f"Each post now has {MIN_LIKES_PER_POST}-{MAX_LIKES_PER_POST} likes")
    except Exception as e:
        print(f"Error in main process: {e}")
        print(traceback.format_exc())

if __name__ == "__main__":
    main() 