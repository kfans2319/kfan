#!/usr/bin/env python3
"""
Blank User Generator Script

This script generates one million blank user profiles that:
1. Have random usernames and emails
2. All share the same password: Trigun1!
3. Follow all users that have posts
4. Generate likes on posts with random distributions
"""

import os
import json
import uuid
import time
import random
import subprocess
from datetime import datetime, timedelta
import traceback

# Configuration
USER_PASSWORD = 'Trigun1!'
TOTAL_USERS = 1000000  # 1 million users
BATCH_SIZE = 1000  # Create users in batches of 1000
MIN_FOLLOWERS = 500
MAX_FOLLOWERS = 500000
MIN_LIKES = 500
MAX_LIKES = 500000

# Arrays to store adjectives and nouns for username generation
adjectives = [
    'happy', 'brave', 'creative', 'swift', 'clever', 'bright', 'mighty', 'calm',
    'wise', 'great', 'bold', 'fancy', 'magical', 'super', 'jolly', 'wild',
    'fierce', 'gentle', 'smart', 'kind', 'smooth', 'shiny', 'quick', 'silent'
]

nouns = [
    'tiger', 'dragon', 'panda', 'fox', 'wolf', 'eagle', 'lion', 'dolphin',
    'hero', 'ninja', 'wizard', 'knight', 'runner', 'dancer', 'gamer', 'coder',
    'writer', 'artist', 'ranger', 'pilot', 'singer', 'agent', 'racer', 'chef'
]

def generate_random_username():
    """Generate a random username"""
    adjective = random.choice(adjectives)
    noun = random.choice(nouns)
    random_suffix = random.randint(0, 9999)
    return f"{adjective}{noun}{random_suffix}"

def generate_random_email(username):
    """Generate a random email for a username"""
    sanitized_username = ''.join(c for c in username if c.isalnum()).lower()
    random_suffix = random.randint(1000, 9999)
    domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'protonmail.com']
    random_domain = random.choice(domains)
    return f"{sanitized_username}{random_suffix}@{random_domain}"

def run_prisma_script(script):
    """Execute a script with Prisma client using Node.js"""
    # Create a temporary file with the script
    script_path = os.path.join(os.getcwd(), 'scripts', f"temp_{uuid.uuid4()}.js")
    
    # Add Prisma client imports and initialization
    full_script = f"""
const {{ PrismaClient, Prisma }} = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {{
  try {{
    {script}
  }} catch (error) {{
    console.error('Error:', error);
    process.exit(1);
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
            return json.loads(result.stdout.strip())
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

def create_user_batch(batch_number, batch_size):
    """Create a batch of blank users"""
    print(f"Creating batch {batch_number} ({batch_size} users)...")
    
    # Generate user data
    users = []
    for i in range(batch_size):
        username = generate_random_username()
        email = generate_random_email(username)
        user_id = str(uuid.uuid4()).replace('-', '')[:20]
        
        # Generate a random join date
        start_date = datetime(2023, 1, 1, 0, 0, 0)
        end_date = datetime.now()
        random_seconds = random.randint(0, int((end_date - start_date).total_seconds()))
        created_at = start_date + timedelta(seconds=random_seconds)
        
        users.append({
            'id': user_id,
            'username': username,
            'email': email,
            'created_at': created_at.isoformat() + "Z"
        })
    
    # Create a script to hash the password and create users
    create_users_script = f"""
    const {{ hash }} = require('@node-rs/argon2');
    
    // Hash the password once for all users
    const passwordHash = await hash("{USER_PASSWORD}", {{
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    }});
    
    // Prepare user data
    const userData = {json.dumps(users)};
    
    // Create users with createMany
    const result = await prisma.user.createMany({{
      data: userData.map(user => ({{
        id: user.id,
        username: user.username,
        displayName: user.username,
        email: user.email,
        passwordHash: passwordHash,
        isVerified: true,
        verificationStatus: "APPROVED",
        createdAt: new Date(user.created_at)
      }})),
      skipDuplicates: true
    }});
    
    return userData.map(user => user.id);
    """
    
    try:
        user_ids = run_prisma_script(create_users_script)
        print(f"Successfully created batch {batch_number} with {len(user_ids)} users")
        return user_ids
    except Exception as e:
        print(f"Error creating user batch {batch_number}: {e}")
        print(traceback.format_exc())
        return []

def get_users_with_posts():
    """Get all users that have posts"""
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
        _count: {
          select: {
            posts: true
          }
        }
      }
    });
    
    return usersWithPosts;
    """
    
    try:
        users = run_prisma_script(script)
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
        id: true
      }}
    }});
    
    return posts.map(post => post.id);
    """
    
    try:
        posts = run_prisma_script(script)
        return posts
    except Exception as e:
        print(f"Error getting posts for user {user_id}: {e}")
        return []

def create_follows_for_user(target_user_id, follower_count, blank_user_ids):
    """Create follows for a user"""
    print(f"Creating {follower_count:,} follows for user {target_user_id}...")
    
    # Randomly select users to be followers
    selected_users = random.sample(blank_user_ids, min(follower_count, len(blank_user_ids)))
    
    total_follows = 0
    batch_size = 5000  # Process in smaller batches
    
    for i in range(0, len(selected_users), batch_size):
        current_batch = selected_users[i:i+batch_size]
        
        # Create follows in batch
        follows_data = [{'followerId': follower_id, 'followingId': target_user_id} 
                        for follower_id in current_batch]
        
        script = f"""
        const followsData = {json.dumps(follows_data)};
        
        const result = await prisma.follow.createMany({{
          data: followsData,
          skipDuplicates: true
        }});
        
        return result.count;
        """
        
        try:
            result = run_prisma_script(script)
            if result:
                total_follows += result
                print(f"Created {total_follows:,}/{follower_count:,} follows for user {target_user_id}")
            
            # Add small delay between batches
            if i + batch_size < len(selected_users):
                time.sleep(0.5)
        except Exception as e:
            print(f"Error creating follows batch for user {target_user_id}: {e}")
    
    print(f"Finished creating {total_follows:,} follows for user {target_user_id}")
    return total_follows

def create_likes_for_user_posts(user_id, post_ids, blank_user_ids):
    """Create likes on posts for a user"""
    if not post_ids:
        print(f"No posts found for user {user_id}. Skipping like creation.")
        return 0
    
    print(f"Creating likes for {len(post_ids)} posts from user {user_id}...")
    total_likes = 0
    
    for post_id in post_ids:
        # Random number of likes for this post
        like_count = random.randint(MIN_LIKES, MAX_LIKES)
        like_count = min(like_count, len(blank_user_ids))
        
        # Randomly select users to be likers
        selected_users = random.sample(blank_user_ids, like_count)
        
        print(f"Creating {like_count:,} likes for post {post_id}...")
        
        created_likes = 0
        batch_size = 5000  # Process in smaller batches
        
        for i in range(0, len(selected_users), batch_size):
            current_batch = selected_users[i:i+batch_size]
            
            # Create likes in batch
            likes_data = [{'userId': user_id, 'postId': post_id} for user_id in current_batch]
            
            script = f"""
            const likesData = {json.dumps(likes_data)};
            
            const result = await prisma.like.createMany({{
              data: likesData,
              skipDuplicates: true
            }});
            
            return result.count;
            """
            
            try:
                result = run_prisma_script(script)
                if result:
                    created_likes += result
                    total_likes += result
                
                # Add small delay between batches
                if i + batch_size < len(selected_users):
                    time.sleep(0.2)
            except Exception as e:
                print(f"Error creating likes batch for post {post_id}: {e}")
        
        print(f"Created {created_likes:,} likes for post {post_id}")
    
    print(f"Finished creating {total_likes:,} likes for user {user_id}'s posts")
    return total_likes

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
        return False

def main():
    """Main function to run the script"""
    print("Starting blank user generation process...")
    print(f"Target: {TOTAL_USERS:,} blank users")
    
    try:
        # Get users with posts first
        users_with_posts = get_users_with_posts()
        
        if not users_with_posts:
            print("No users with posts found. Cannot proceed with follower/like creation.")
            return
        
        print(f"Found {len(users_with_posts)} users with posts who will receive followers and likes")
        
        # Calculate the total number of batches
        total_batches = (TOTAL_USERS + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"Will create users in {total_batches} batches of {BATCH_SIZE} users each")
        
        # Create users in batches and collect all user IDs
        all_blank_user_ids = []
        for batch_num in range(1, total_batches + 1):
            # For the last batch, may need fewer than BATCH_SIZE
            current_batch_size = min(BATCH_SIZE, TOTAL_USERS - (batch_num - 1) * BATCH_SIZE)
            
            print(f"Creating batch {batch_num}/{total_batches} ({current_batch_size} users)...")
            batch_user_ids = create_user_batch(batch_num, current_batch_size)
            all_blank_user_ids.extend(batch_user_ids)
            
            print(f"Progress: {len(all_blank_user_ids):,}/{TOTAL_USERS:,} users created ({len(all_blank_user_ids) / TOTAL_USERS * 100:.2f}%)")
            
            # Add delay between batches
            if batch_num < total_batches:
                print("Waiting 3 seconds before next batch...")
                time.sleep(3)
        
        print(f"Successfully created {len(all_blank_user_ids):,} blank users")
        
        # Create follows and likes for each user with posts
        for user in users_with_posts:
            user_id = user['id']
            
            # Get a random follower count for this user
            follower_count = random.randint(MIN_FOLLOWERS, MAX_FOLLOWERS)
            actual_follower_count = min(follower_count, len(all_blank_user_ids))
            
            # Update follower count in metadata table
            update_follower_count_metadata(user_id, actual_follower_count)
            
            # Create follows
            create_follows_for_user(user_id, actual_follower_count, all_blank_user_ids)
            
            # Get all posts for this user
            post_ids = get_user_posts(user_id)
            
            # Create likes for each post
            if post_ids:
                create_likes_for_user_posts(user_id, post_ids, all_blank_user_ids)
            
            # Small delay between processing users
            time.sleep(1)
        
        print("\n----------------------------------------")
        print("Blank user generation completed")
        print("----------------------------------------")
        print(f"Total blank users created: {len(all_blank_user_ids):,}")
        print(f"Users with followers and likes: {len(users_with_posts)}")
        
    except Exception as e:
        print(f"Error in main process: {e}")
        print(traceback.format_exc())

if __name__ == "__main__":
    main() 