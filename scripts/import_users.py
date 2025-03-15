#!/usr/bin/env python3
"""
User Import Script

This script imports user profiles from the downloads folder and creates:
1. User accounts
2. Avatar and banner images
3. Posts with remaining images
4. Subscription tiers
"""

import os
import json
import uuid
import time
import random
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
import traceback

# Configuration
DOWNLOADS_DIR = os.path.join(os.getcwd(), 'downloads')
USER_PASSWORD = 'trigun1'
UPLOAD_APP_ID = os.environ.get('NEXT_PUBLIC_UPLOADTHING_APP_ID', 'local')
PUBLIC_DIR = os.path.join(os.getcwd(), 'public', 'a', UPLOAD_APP_ID)

# Make sure public directory exists
os.makedirs(PUBLIC_DIR, exist_ok=True)

def generate_random_email(username):
    """Generate a random email for a user"""
    sanitized_username = ''.join(c for c in username if c.isalnum()).lower()
    random_suffix = random.randint(1000, 9999)
    domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'protonmail.com']
    random_domain = random.choice(domains)
    return f"{sanitized_username}{random_suffix}@{random_domain}"

def process_image(source_path):
    """Process an image and return its public URL"""
    try:
        # Generate a random file name with the same extension
        extension = os.path.splitext(source_path)[1]
        random_filename = f"{uuid.uuid4()}{extension}"
        
        # Create the URL that would be used in the database
        image_url = f"/a/{UPLOAD_APP_ID}/{random_filename}"
        
        # Copy file to public folder
        destination_path = os.path.join(PUBLIC_DIR, random_filename)
        shutil.copy2(source_path, destination_path)
        
        print(f"Image processed: {os.path.basename(source_path)} -> {image_url}")
        return image_url
    except Exception as e:
        print(f"Error processing image ({os.path.basename(source_path)}): {e}")
        raise

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

def create_user(username, email, password):
    """Create a user account"""
    print(f"Creating user: {username} ({email})")
    
    # Check if user already exists
    existing_user_script = f"""
    const existingUser = await prisma.user.findFirst({{
      where: {{
        OR: [
          {{ username: {{ equals: "{username}", mode: 'insensitive' }} }},
          {{ email: {{ equals: "{email}", mode: 'insensitive' }} }}
        ]
      }}
    }});
    
    return existingUser;
    """
    
    existing_user = run_prisma_script(existing_user_script)
    
    if existing_user:
        print(f"User {username} or email {email} already exists. Skipping creation.")
        return existing_user
    
    # Generate a random ID
    user_id = str(uuid.uuid4()).replace('-', '')[:20]
    
    # Generate a random join date between January 1, 2023 and now
    start_date = datetime(2023, 1, 1, 0, 0, 0)
    now = datetime.now()
    random_seconds = random.randint(0, int((now - start_date).total_seconds()))
    created_at = start_date + timedelta(seconds=random_seconds)
    created_at_iso = created_at.isoformat() + "Z"
    
    print(f"Setting join date to: {created_at_iso}")
    
    # Create the user
    create_user_script = f"""
    const {{ hash }} = require('@node-rs/argon2');
    
    // Generate password hash
    const passwordHash = await hash("{password}", {{
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    }});
    
    const newUser = await prisma.user.create({{
      data: {{
        id: "{user_id}",
        username: "{username}",
        displayName: "{username}",
        email: "{email}",
        passwordHash,
        isVerified: true,
        verificationStatus: "APPROVED",
        createdAt: new Date("{created_at_iso}"), // Set the random join date
      }}
    }});
    
    return newUser;
    """
    
    user = run_prisma_script(create_user_script)
    print(f"User created successfully: {username} (ID: {user['id']})")
    return user

def create_subscription_tiers(user_id):
    """Create subscription tiers for a user"""
    print(f"Creating subscription tiers for user {user_id}")
    
    # Define tier configurations
    tiers = [
        {
            "name": "Basic",
            "description": "Basic subscription with limited content",
            "price_range": (5, 15),
            "duration_range": (1, 3)
        },
        {
            "name": "Premium",
            "description": "Premium subscription with exclusive content",
            "price_range": (16, 30),
            "duration_range": (1, 6)
        },
        {
            "name": "VIP",
            "description": "VIP subscription with all content and special perks",
            "price_range": (31, 50),
            "duration_range": (4, 12)
        }
    ]
    
    created_tiers = []
    
    for tier in tiers:
        # Generate random price and duration within the specified ranges
        price = random.randint(tier["price_range"][0], tier["price_range"][1])
        duration = random.randint(tier["duration_range"][0], tier["duration_range"][1])
        
        create_tier_script = f"""
        const tier = await prisma.subscriptionTier.create({{
          data: {{
            name: "{tier['name']}",
            description: "{tier['description']}",
            price: new Prisma.Decimal({price}),
            duration: {duration},
            creatorId: "{user_id}"
          }}
        }});
        
        return tier;
        """
        
        tier = run_prisma_script(create_tier_script)
        created_tiers.append(tier)
    
    print(f"Created {len(created_tiers)} subscription tiers for user {user_id}")
    return created_tiers

def update_user_images(user_id, avatar_url, banner_url):
    """Update user with avatar and banner images"""
    print(f"Updating user {user_id} with avatar and banner images")
    print(f"Avatar URL: {avatar_url}")
    print(f"Banner URL: {banner_url}")
    
    update_script = f"""
    const updatedUser = await prisma.user.update({{
      where: {{ id: "{user_id}" }},
      data: {{
        avatarUrl: "{avatar_url}",
        bannerImageUrl: "{banner_url}",
      }}
    }});
    
    return updatedUser;
    """
    
    updated_user = run_prisma_script(update_script)
    print(f"User images updated successfully")
    return updated_user

def get_image_description(image_path):
    """Find and read the description file for an image"""
    try:
        # Get the image filename without extension
        image_dir = os.path.dirname(image_path)
        image_basename = os.path.basename(image_path)
        image_name_without_ext = os.path.splitext(image_basename)[0]
        
        # Construct the description file path
        description_filename = f"{image_name_without_ext}_description.txt"
        description_path = os.path.join(image_dir, description_filename)
        
        # Check if the description file exists
        if os.path.exists(description_path):
            print(f"Found description file: {description_filename}")
            # Read the description file content
            with open(description_path, 'r', encoding='utf-8') as file:
                description = file.read().strip()
            return description
        else:
            # Also check the parent directory if image is in a subdirectory
            parent_dir = os.path.dirname(image_dir)
            alt_description_path = os.path.join(parent_dir, description_filename)
            
            if os.path.exists(alt_description_path):
                print(f"Found description file in parent directory: {description_filename}")
                with open(alt_description_path, 'r', encoding='utf-8') as file:
                    description = file.read().strip()
                return description
            
            print(f"No description file found for {image_basename}")
            return ''
    except Exception as e:
        print(f"Error reading description for {os.path.basename(image_path)}: {e}")
        return ''

def create_post(user_id, image_path, is_public=False):
    """Create a post with an image"""
    print(f"Creating post for user {user_id} with image: {os.path.basename(image_path)}")
    
    # Get the description for this image
    post_content = get_image_description(image_path)
    
    # Process the image
    image_url = process_image(image_path)
    
    create_post_script = f"""
    // Create the media entry
    const media = await prisma.media.create({{
      data: {{
        url: "{image_url}",
        type: "IMAGE",
      }}
    }});
    
    // Create the post
    const post = await prisma.post.create({{
      data: {{
        content: {json.dumps(post_content)}, // Use the description as post content
        userId: "{user_id}",
        isPublic: {"true" if is_public else "false"}, // Setting to false for subscriber-only
        attachments: {{
          connect: [{{ id: media.id }}]
        }}
      }}
    }});
    
    return post;
    """
    
    post = run_prisma_script(create_post_script)
    
    if post_content:
        preview = post_content[:50] + ('...' if len(post_content) > 50 else '')
        print(f"Post created successfully (ID: {post['id']}) with description: \"{preview}\"")
    else:
        print(f"Post created successfully (ID: {post['id']}) with no description")
    
    return post

def update_follower_count(user_id):
    """Update user with a random follower count"""
    # Generate a random follower count between 100 and 500,000
    follower_count = random.randint(100, 500000)
    
    print(f"Setting follower count for user {user_id} to {follower_count:,}")
    
    try:
        # Create a metadata table to store the follower count
        # This avoids trying to update a non-existent field directly
        create_table_script = """
        try {
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
                VALUES ('${userId}', ${followerCount}, NOW(), NOW())
                ON CONFLICT (userid) 
                DO UPDATE SET followercount = ${followerCount}, updatedat = NOW()
            `;
            
            return { success: true, count: followerCount };
        } catch (e) {
            console.error("Error storing follower count metadata:", e);
            return { success: false, error: e.message };
        }
        """.replace("${userId}", user_id).replace("${followerCount}", str(follower_count))
        
        result = run_prisma_script(create_table_script)
        
        if result and result.get('success'):
            print(f"Follower count metadata stored successfully")
            return follower_count
        else:
            print(f"Unable to store follower count metadata: {result.get('error') if result else 'Unknown error'}")
            print(f"Continuing without setting follower count")
            return 0
    except Exception as e:
        print(f"Error storing follower count metadata: {e}")
        print(f"Continuing without setting follower count")
        return 0

def process_user_folder(folder_path):
    """Process a single user folder"""
    folder_name = os.path.basename(folder_path)
    print(f"\n========================================")
    print(f"Processing user folder: {folder_name}")
    print(f"========================================")
    
    try:
        # Use the folder name as the username since profile_data.json might not exist
        username = folder_name
        email = generate_random_email(username)
        
        # Create the user
        user = create_user(username, email, USER_PASSWORD)
        
        # Update follower count with a random number
        update_follower_count(user['id'])
        
        # List all files in the folder for debugging
        print(f"Scanning folder contents for {folder_name}...")
        all_files = os.listdir(folder_path)
        print(f"Found {len(all_files)} total files/directories in the folder")
        
        # Get all images with more extensive extension checking
        valid_image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')
        image_files = []
        
        for file in all_files:
            ext = os.path.splitext(file)[1].lower()
            if ext in valid_image_extensions:
                image_files.append(os.path.join(folder_path, file))
        
        # Sort files for consistent processing order
        image_files.sort()
        
        print(f"Found {len(image_files)} image files with extensions: {', '.join(valid_image_extensions)}")
        
        # Check for images in potential subdirectories
        potential_images_dir = os.path.join(folder_path, 'images')
        subdir_image_files = []
        
        if os.path.exists(potential_images_dir) and os.path.isdir(potential_images_dir):
            print(f"Checking 'images' subdirectory...")
            sub_dir_files = os.listdir(potential_images_dir)
            
            for file in sub_dir_files:
                ext = os.path.splitext(file)[1].lower()
                if ext in valid_image_extensions:
                    subdir_image_files.append(os.path.join(potential_images_dir, file))
            
            if len(subdir_image_files) > 0:
                print(f"Found {len(subdir_image_files)} images in 'images' subdirectory")
                subdir_image_files.sort()
                
                # Use subdirectory images if main directory has none or fewer than 2
                if len(image_files) < 2:
                    print(f"Using images from subdirectory instead of main folder")
                    image_files = subdir_image_files
                else:
                    # Always merge in subdirectory images to have more content to choose from
                    print(f"Merging images from main folder and subdirectory")
                    image_files.extend(subdir_image_files)
                    image_files.sort()
        
        if len(image_files) < 2:
            print(f"Not enough images found for {folder_name}. Need at least 2 for avatar and banner.")
            print(f"Files found in directory: {', '.join(os.path.basename(f) for f in all_files)}")
            return False
        
        print(f"Processing {len(image_files)} images for user {username}")
        if len(image_files) >= 5:
            print(f"First 5 image paths: {', '.join(os.path.basename(f) for f in image_files[:5])}")
        else:
            print(f"All image paths: {', '.join(os.path.basename(f) for f in image_files)}")
        
        # Process avatar (first image)
        avatar_image = image_files[0]
        avatar_url = process_image(avatar_image)
        print(f"Set avatar image: {avatar_url} from {os.path.basename(avatar_image)}")
        
        # Process banner (second image)
        banner_image = image_files[1]
        banner_url = process_image(banner_image)
        print(f"Set banner image: {banner_url} from {os.path.basename(banner_image)}")
        
        # Double-check that avatar URL is not empty
        if not avatar_url:
            print(f"Avatar URL is empty for user {username}. This should not happen.")
            return False
        
        # Update user with avatar and banner images
        update_user_images(user['id'], avatar_url, banner_url)
        print(f"Avatar and banner images confirmed set for user {username}")
        
        # Create subscription tiers for the user
        create_subscription_tiers(user['id'])
        
        # Get all images after avatar and banner (starting from index 2)
        remaining_images = image_files[2:]
        
        # Determine how many posts to create (random between 10 and 50, or all if less than 10)
        post_count = min(len(remaining_images), random.randint(10, 50))
        
        # Randomly select images for posts
        random.shuffle(remaining_images)
        post_images = remaining_images[:post_count]
        
        print(f"Creating {len(post_images)} posts (randomly selected) for user {username}")
        
        for i, image_path in enumerate(post_images):
            # All posts are subscriber-only
            is_public = False
            
            create_post(user['id'], image_path, is_public)
            
            # Log post creation
            print(f"Created subscriber-only post {i + 1}/{len(post_images)}")
            
            # Add a small delay between posts
            time.sleep(0.5)
        
        print(f"Successfully processed user {username} with {len(post_images)} posts")
        return True
    except Exception as e:
        print(f"Error processing user folder {folder_name}: {e}")
        print(f"Error traceback: {traceback.format_exc()}")
        return False

def main():
    """Main function to run the script"""
    print("Starting user import process...")
    
    try:
        # Get all user folders
        user_folders = [
            os.path.join(DOWNLOADS_DIR, f) 
            for f in os.listdir(DOWNLOADS_DIR) 
            if os.path.isdir(os.path.join(DOWNLOADS_DIR, f))
        ]
        
        print(f"Found {len(user_folders)} user folders to process")
        
        # Process each user folder
        processed = 0
        errors = 0
        
        # Process in batches to avoid memory issues
        BATCH_SIZE = 3
        for i in range(0, len(user_folders), BATCH_SIZE):
            batch = user_folders[i:i + BATCH_SIZE]
            
            print(f"\nProcessing batch {i // BATCH_SIZE + 1} of {(len(user_folders) + BATCH_SIZE - 1) // BATCH_SIZE}")
            
            # Process each folder in the batch
            for folder in batch:
                try:
                    success = process_user_folder(folder)
                    if success:
                        processed += 1
                    else:
                        errors += 1
                except Exception as e:
                    print(f"Failed to process folder {folder}: {e}")
                    errors += 1
            
            print(f"Batch completed. Success: {processed}/{i + len(batch)}")
            
            # Add a delay between batches
            if i + BATCH_SIZE < len(user_folders):
                print(f"Waiting 3 seconds before next batch...")
                time.sleep(3)
        
        # Final summary
        print("\n----------------------------------------")
        print("Import process completed")
        print("----------------------------------------")
        print(f"Total users: {len(user_folders)}")
        print(f"Successfully processed: {processed}")
        print(f"Errors: {errors}")
    except Exception as e:
        print(f"Error in main process: {e}")

if __name__ == "__main__":
    main() 