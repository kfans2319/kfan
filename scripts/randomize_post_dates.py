#!/usr/bin/env python3
"""
This script updates all posts in the database with random dates
between January 2024 and the current date to create a more natural
timeline distribution for the "For You" page.hi
"""

import os
import sys
import json
import random
import datetime
import subprocess
from typing import List, Dict, Any, Optional

# Configuration
BATCH_SIZE = 100  # Process posts in batches to avoid memory issues
START_DATE = datetime.datetime(2024, 1, 1)  # January 1, 2024
END_DATE = datetime.datetime.now()  # Current date

def get_random_date(start_date: datetime.datetime, end_date: datetime.datetime) -> datetime.datetime:
    """
    Generate a random date between start and end dates
    
    Args:
        start_date: Start date
        end_date: End date
        
    Returns:
        Random date between start and end
    """
    delta = end_date - start_date
    random_days = random.randint(0, delta.days)
    random_seconds = random.randint(0, 86399)  # 24 hours in seconds - 1
    
    return start_date + datetime.timedelta(days=random_days, seconds=random_seconds)

def format_iso_date(date: datetime.datetime) -> str:
    """Format date as ISO string for Prisma"""
    return date.strftime('%Y-%m-%dT%H:%M:%S.%fZ')

def run_prisma_script(script: str) -> Optional[Dict[str, Any]]:
    """
    Run a Prisma script using Node
    
    Args:
        script: Prisma script as string
        
    Returns:
        JSON result or None if error
    """
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
        print(f"Error running Prisma script: {e}")
        print(f"Stderr: {e.stderr}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

def count_posts() -> int:
    """Count the total number of posts in the database"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function countPosts() {
        try {
            const count = await prisma.post.count();
            console.log(JSON.stringify({ count }));
        } catch (error) {
            console.error('Error counting posts:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countPosts();
    """
    
    result = run_prisma_script(script)
    if result and 'count' in result:
        return result['count']
    return 0

def get_posts_batch(skip: int, take: int) -> List[Dict[str, Any]]:
    """
    Get a batch of posts from the database
    
    Args:
        skip: Number of posts to skip
        take: Number of posts to take
        
    Returns:
        List of post objects
    """
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function getPosts() {{
        try {{
            const posts = await prisma.post.findMany({{
                skip: {skip},
                take: {take},
                select: {{
                    id: true
                }},
                orderBy: {{
                    createdAt: 'asc'
                }}
            }});
            console.log(JSON.stringify({{ posts }}));
        }} catch (error) {{
            console.error('Error fetching posts:', error);
            console.log(JSON.stringify({{ error: error.message }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    getPosts();
    """
    
    result = run_prisma_script(script)
    if result and 'posts' in result:
        return result['posts']
    return []

def update_post(post_id: str, created_at: datetime.datetime) -> bool:
    """
    Update a post with a new random date
    
    Args:
        post_id: Post ID
        created_at: New creation date
        
    Returns:
        True if successful, False otherwise
    """
    formatted_date = format_iso_date(created_at)
    
    script = f"""
    const {{ PrismaClient }} = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function updatePost() {{
        try {{
            await prisma.post.update({{
                where: {{ id: "{post_id}" }},
                data: {{ 
                    createdAt: new Date("{formatted_date}")
                    // Removed updatedAt as it doesn't exist in the schema
                }}
            }});
            console.log(JSON.stringify({{ success: true }}));
        }} catch (error) {{
            console.error(`Error updating post {{post_id}}:`, error);
            console.log(JSON.stringify({{ error: error.message }}));
        }} finally {{
            await prisma.$disconnect();
        }}
    }}
    
    updatePost();
    """
    
    result = run_prisma_script(script)
    return result and result.get('success', False)

def update_post_batch(posts: List[Dict[str, Any]]) -> int:
    """
    Update a batch of posts with random dates
    
    Args:
        posts: List of post objects
        
    Returns:
        Number of successfully updated posts
    """
    success_count = 0
    
    for i, post in enumerate(posts):
        random_date = get_random_date(START_DATE, END_DATE)
        success = update_post(post['id'], random_date)
        
        if success:
            success_count += 1
        
        # Log progress every 10 posts
        if (i + 1) % 10 == 0 or i == len(posts) - 1:
            print(f"Updated {i + 1}/{len(posts)} posts in current batch ({success_count} successful)")
    
    return success_count

def randomize_post_dates():
    """Main function to update all post dates"""
    print("Starting post date randomization...")
    print(f"Date range: {START_DATE.isoformat()} to {END_DATE.isoformat()}")
    
    # Count total posts
    total_posts = count_posts()
    print(f"Found {total_posts} posts to process")
    
    if total_posts == 0:
        print("No posts found. Exiting.")
        return
    
    skip = 0
    total_updated = 0
    batch_count = 0
    
    try:
        while True:
            # Fetch a batch of posts
            posts = get_posts_batch(skip, BATCH_SIZE)
            
            # Break if no more posts to process
            if not posts:
                break
            
            batch_count += 1
            print(f"\nProcessing batch {batch_count} ({len(posts)} posts)...")
            
            # Update the batch
            updated_count = update_post_batch(posts)
            total_updated += updated_count
            
            print(f"Batch {batch_count} complete. Updated {updated_count}/{len(posts)} posts.")
            
            progress_percentage = round(total_updated / total_posts * 100) if total_posts > 0 else 0
            print(f"Progress: {total_updated}/{total_posts} posts ({progress_percentage}%)")
            
            # Move to next batch
            skip += BATCH_SIZE
        
        print("\nPost date randomization complete!")
        print(f"Successfully updated {total_updated} posts with random dates.")
        
    except KeyboardInterrupt:
        print("\nProcess interrupted by user.")
        print(f"Partially completed: {total_updated}/{total_posts} posts updated.")
    except Exception as e:
        print(f"An error occurred during post date randomization: {e}")

if __name__ == "__main__":
    randomize_post_dates() 