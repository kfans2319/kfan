/**
 * User Import Script
 * 
 * This script imports user profiles from the downloads folder and creates:
 * 1. User accounts
 * 2. Avatar and banner images
 * 3. Posts with remaining images
 * 4. Subscription tiers
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');
const { generateIdFromEntropySize } = require('lucia');
const crypto = require('crypto');
const { StreamChat } = require('stream-chat');

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');
const USER_PASSWORD = 'trigun1';

// Add Stream Chat client initialization
const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY,
  process.env.STREAM_SECRET
);

/**
 * Generate a random email
 * @param {string} username The username to use as a basis for the email
 * @returns {string} A random email
 */
function generateRandomEmail(username) {
  const sanitizedUsername = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'protonmail.com'];
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  return `${sanitizedUsername}${randomSuffix}@${randomDomain}`;
}

/**
 * Create a user account directly in the database
 * @param {string} username The username
 * @param {string} email The email
 * @param {string} password The password
 * @returns {Promise<object>} The created user
 */
async function createUser(username, email, password) {
  console.log(`Creating user: ${username} (${email})`);
  
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { email: { equals: email, mode: 'insensitive' } }
        ]
      }
    });

    if (existingUser) {
      console.log(`User ${username} or email ${email} already exists. Skipping creation.`);
      return existingUser;
    }

    // Generate password hash
    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // Generate a unique ID for the user
    const userId = generateIdFromEntropySize(10);
    
    // Generate a random join date between January 1, 2023 and now
    const startDate = new Date('2023-01-01T00:00:00Z');
    const now = new Date();
    const randomTimestamp = startDate.getTime() + Math.random() * (now.getTime() - startDate.getTime());
    const createdAt = new Date(randomTimestamp);
    
    console.log(`Setting join date to: ${createdAt.toISOString()}`);

    // Create the user in the database
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        username,
        displayName: username,
        email,
        passwordHash,
        isVerified: true, // Set to verified so they can post content
        verificationStatus: 'APPROVED',
        createdAt, // Set the random join date
      }
    });

    // Register user with Stream Chat
    try {
      await streamClient.upsertUser({
        id: userId,
        username,
        name: username,
      });
      console.log(`Registered user ${username} with Stream Chat`);
    } catch (streamError) {
      console.error(`Error registering user with Stream Chat: ${streamError}`);
      // Continue processing even if Stream Chat registration fails
    }

    console.log(`User created successfully: ${username} (ID: ${userId})`);
    return newUser;
  } catch (error) {
    console.error(`Error creating user ${username}:`, error);
    throw error;
  }
}

/**
 * Create subscription tiers for a user
 * @param {string} userId The user ID
 * @returns {Promise<Array>} Array of created subscription tiers
 */
async function createSubscriptionTiers(userId) {
  console.log(`Creating subscription tiers for user ${userId}`);
  
  try {
    // Define tier levels with appropriate pricing and duration ranges
    const tiers = [
      {
        name: 'Basic',
        description: 'Basic subscription with limited content',
        priceRange: { min: 5, max: 15 },
        durationRange: { min: 1, max: 3 }
      },
      {
        name: 'Premium',
        description: 'Premium subscription with exclusive content',
        priceRange: { min: 16, max: 30 },
        durationRange: { min: 1, max: 6 }
      },
      {
        name: 'VIP',
        description: 'VIP subscription with all content and special perks',
        priceRange: { min: 31, max: 50 },
        durationRange: { min: 4, max: 12 }
      }
    ];
    
    // Create subscription tiers with random prices and durations within defined ranges
    const createdTiers = await Promise.all(tiers.map(async (tier) => {
      // Generate random price and duration within range
      const price = Math.floor(Math.random() * (tier.priceRange.max - tier.priceRange.min + 1)) + tier.priceRange.min;
      const duration = Math.floor(Math.random() * (tier.durationRange.max - tier.durationRange.min + 1)) + tier.durationRange.min;
      
      return prisma.subscriptionTier.create({
        data: {
          name: tier.name,
          description: tier.description,
          price: new Prisma.Decimal(price),
          duration,
          creatorId: userId
        }
      });
    }));
    
    console.log(`Created ${createdTiers.length} subscription tiers for user ${userId}`);
    return createdTiers;
  } catch (error) {
    console.error(`Error creating subscription tiers for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Copy image file to public directory and return path for database
 * @param {string} sourcePath Source path of the image
 * @param {string} type Type of image (avatar or banner)
 * @param {string} userId User ID
 * @returns {Promise<string>} The path to the copied image
 */
async function processImage(sourcePath, userId) {
  try {
    // Generate a random file name
    const extension = path.extname(sourcePath);
    const randomFilename = `${crypto.randomUUID()}${extension}`;
    
    // Create the URL that would be used in the database
    const appId = process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID || 'local';
    const imageUrl = `/a/${appId}/${randomFilename}`;
    
    // Copy file to public folder for testing purposes
    const publicDir = path.join(process.cwd(), 'public', 'a', appId);
    
    // Ensure the directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Copy the file
    fs.copyFileSync(sourcePath, path.join(publicDir, randomFilename));
    
    console.log(`Image processed successfully: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error(`Error processing image (${sourcePath}):`, error);
    throw error;
  }
}

/**
 * Update user with avatar and banner images
 * @param {string} userId User ID
 * @param {string} avatarUrl Avatar URL
 * @param {string} bannerImageUrl Banner image URL
 * @returns {Promise<object>} Updated user
 */
async function updateUserImages(userId, avatarUrl, bannerImageUrl) {
  console.log(`Updating user ${userId} with avatar and banner images`);
  console.log(`Avatar URL: ${avatarUrl}`);
  console.log(`Banner URL: ${bannerImageUrl}`);
  
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl,
        bannerImageUrl,
      }
    });
    
    console.log(`User images updated successfully`);
    return updatedUser;
  } catch (error) {
    console.error(`Error updating user images:`, error);
    throw error;
  }
}

/**
 * Find and read the description file for an image
 * @param {string} imagePath Path to the image
 * @returns {string} The description content or empty string if not found
 */
function getImageDescription(imagePath) {
  try {
    // Get the image filename without extension
    const imageDir = path.dirname(imagePath);
    const imageBasename = path.basename(imagePath);
    const imageNameWithoutExt = imageBasename.substring(0, imageBasename.lastIndexOf('.'));
    
    // Construct the description file path
    const descriptionFilename = `${imageNameWithoutExt}_description.txt`;
    const descriptionPath = path.join(imageDir, descriptionFilename);
    
    // Check if the description file exists
    if (fs.existsSync(descriptionPath)) {
      console.log(`Found description file: ${descriptionFilename}`);
      // Read the description file content
      const description = fs.readFileSync(descriptionPath, 'utf8').trim();
      return description;
    } else {
      // Also check the parent directory if image is in a subdirectory
      const parentDir = path.dirname(imageDir);
      const altDescriptionPath = path.join(parentDir, descriptionFilename);
      
      if (fs.existsSync(altDescriptionPath)) {
        console.log(`Found description file in parent directory: ${descriptionFilename}`);
        const description = fs.readFileSync(altDescriptionPath, 'utf8').trim();
        return description;
      }
      
      console.log(`No description file found for ${imageBasename}`);
      return '';
    }
  } catch (error) {
    console.error(`Error reading description for ${path.basename(imagePath)}:`, error);
    return '';
  }
}

/**
 * Create a post with an image
 * @param {string} userId User ID
 * @param {string} imagePath Path to the image
 * @param {boolean} isPublic Whether the post is public
 * @returns {Promise<object>} The created post
 */
async function createPost(userId, imagePath, isPublic = false) {
  console.log(`Creating post for user ${userId} with image: ${path.basename(imagePath)}`);
  
  try {
    // Get the description for this image
    const postContent = getImageDescription(imagePath);
    
    // Process the image and get the URL
    const imageUrl = await processImage(imagePath, userId);
    
    // Create the media entry
    const media = await prisma.media.create({
      data: {
        url: imageUrl,
        type: 'IMAGE',
      }
    });
    
    // Create the post
    const post = await prisma.post.create({
      data: {
        content: postContent, // Use the description as post content
        userId,
        isPublic, // Setting this to false by default for subscriber-only posts
        attachments: {
          connect: [{ id: media.id }]
        }
      }
    });
    
    if (postContent) {
      console.log(`Post created successfully (ID: ${post.id}) with description: "${postContent.substring(0, 50)}${postContent.length > 50 ? '...' : ''}"`);
    } else {
      console.log(`Post created successfully (ID: ${post.id}) with no description`);
    }
    
    return post;
  } catch (error) {
    console.error(`Error creating post:`, error);
    throw error;
  }
}

/**
 * Update user's follower count by creating dummy follow relationships
 * @param {string} userId User ID
 * @returns {Promise<number>} Number of followers created
 */
async function updateFollowerCount(userId) {
  // Generate a random follower count between 100 and 500,000
  const followerCount = Math.floor(Math.random() * 499901) + 100;
  
  console.log(`Setting follower count for user ${userId} to ${followerCount.toLocaleString()}`);
  
  try {
    // Instead of directly updating a non-existent followerCount field,
    // we'll create a raw SQL query to insert a record in a custom metadata table
    // that stores the target follower count
    await prisma.$executeRaw`
      INSERT INTO _followmeta (userid, followercount, createdat, updatedat)
      VALUES (${userId}, ${followerCount}, NOW(), NOW())
      ON CONFLICT (userid) 
      DO UPDATE SET followercount = ${followerCount}, updatedat = NOW()
    `.catch(e => {
      // If the table doesn't exist, create it first
      if (e.message.includes('relation "_followmeta" does not exist')) {
        return prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS _followmeta (
            userid TEXT PRIMARY KEY,
            followercount INTEGER NOT NULL,
            createdat TIMESTAMP NOT NULL,
            updatedat TIMESTAMP NOT NULL
          )
        `.then(() => prisma.$executeRaw`
          INSERT INTO _followmeta (userid, followercount, createdat, updatedat)
          VALUES (${userId}, ${followerCount}, NOW(), NOW())
        `);
      }
      throw e;
    });
    
    console.log(`Follower count metadata stored successfully`);
    return followerCount;
  } catch (error) {
    // If we can't use the metadata table approach, log the error but don't fail
    console.error(`Error storing follower count metadata:`, error);
    console.log(`Continuing without setting follower count`);
    return 0;
  }
}

/**
 * Process a single user folder
 * @param {string} userFolder The path to the user folder
 * @returns {Promise<void>}
 */
async function processUserFolder(userFolder) {
  const folderName = path.basename(userFolder);
  console.log(`\n========================================`);
  console.log(`Processing user folder: ${folderName}`);
  console.log(`========================================`);

  try {
    // Use the folder name as the username since profile_data.json might not exist
    const username = folderName;
    const email = generateRandomEmail(username);
    
    // Create the user
    const user = await createUser(username, email, USER_PASSWORD);

    // Update follower count with a random number
    await updateFollowerCount(user.id);

    // List all files in the folder for debugging
    console.log(`Scanning folder contents for ${folderName}...`);
    const allFiles = fs.readdirSync(userFolder);
    console.log(`Found ${allFiles.length} total files/directories in the folder`);
    
    // Get all images with more extensive extension checking
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    let imageFiles = allFiles
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return validImageExtensions.includes(ext);
      })
      .map(file => path.join(userFolder, file))
      // Sort files for consistent processing order
      .sort();

    console.log(`Found ${imageFiles.length} image files with extensions: ${validImageExtensions.join(', ')}`);
    
    // Check for images in potential subdirectories
    const potentialImagesDir = path.join(userFolder, 'images');
    let subdirImageFiles = [];
    
    if (fs.existsSync(potentialImagesDir) && fs.statSync(potentialImagesDir).isDirectory()) {
      console.log(`Checking 'images' subdirectory...`);
      const subDirFiles = fs.readdirSync(potentialImagesDir);
      subdirImageFiles = subDirFiles
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return validImageExtensions.includes(ext);
        })
        .map(file => path.join(potentialImagesDir, file))
        .sort();
        
      if (subdirImageFiles.length > 0) {
        console.log(`Found ${subdirImageFiles.length} images in 'images' subdirectory`);
        
        // Use subdirectory images if main directory has none or fewer than 2
        if (imageFiles.length < 2) {
          console.log(`Using images from subdirectory instead of main folder`);
          imageFiles = subdirImageFiles;
        } else {
          // Always merge in subdirectory images to have more content to choose from
          console.log(`Merging images from main folder and subdirectory`);
          imageFiles = [...imageFiles, ...subdirImageFiles].sort();
        }
      }
    }

    if (imageFiles.length < 2) {
      console.error(`Not enough images found for ${folderName}. Need at least 2 for avatar and banner.`);
      console.error(`Files found in directory: ${allFiles.join(', ')}`);
      return false;
    }

    console.log(`Processing ${imageFiles.length} images for user ${username}`);
    console.log(`First 5 image paths: ${imageFiles.slice(0, 5).map(p => path.basename(p)).join(', ')}`);

    // Process avatar (first image)
    const avatarImage = imageFiles[0];
    const avatarUrl = await processImage(avatarImage, user.id);
    console.log(`Set avatar image: ${avatarUrl} from ${path.basename(avatarImage)}`);

    // Process banner (second image)
    const bannerImage = imageFiles[1];
    const bannerUrl = await processImage(bannerImage, user.id);
    console.log(`Set banner image: ${bannerUrl} from ${path.basename(bannerImage)}`);

    // Double-check that avatar URL is not empty
    if (!avatarUrl) {
      console.error(`Avatar URL is empty for user ${username}. This should not happen.`);
      return false;
    }

    // Update user with avatar and banner images
    await updateUserImages(user.id, avatarUrl, bannerUrl);
    console.log(`Avatar and banner images confirmed set for user ${username}`);

    // Create subscription tiers
    await createSubscriptionTiers(user.id);

    // Get all images after avatar and banner (starting from index 2)
    const remainingImages = imageFiles.slice(2);
    
    // Determine how many posts to create (random between 10 and 50, or all if less than 10)
    let postCount = Math.min(remainingImages.length, Math.floor(Math.random() * 41) + 10);
    
    // Randomly select images for posts
    const shuffledImages = [...remainingImages].sort(() => 0.5 - Math.random());
    const postImages = shuffledImages.slice(0, postCount);
    
    console.log(`Creating ${postImages.length} posts (randomly selected) for user ${username}`);
    
    for (let i = 0; i < postImages.length; i++) {
      const imagePath = postImages[i];
      // All posts are subscriber-only
      const isPublic = false;
      
      await createPost(user.id, imagePath, isPublic);
      
      // Log post creation
      console.log(`Created subscriber-only post ${i + 1}/${postImages.length}`);
      
      // Add a small delay between posts to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`Successfully processed user ${username} with ${postImages.length} posts`);
    return true;
  } catch (error) {
    console.error(`Error processing user folder ${folderName}:`, error);
    return false;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  console.log('Starting user import process...');

  try {
    // Get all user folders
    const userFolders = fs.readdirSync(DOWNLOADS_DIR)
      .map(folder => path.join(DOWNLOADS_DIR, folder))
      .filter(folder => fs.statSync(folder).isDirectory());

    console.log(`Found ${userFolders.length} user folders to process`);

    // Process each user folder
    let processed = 0;
    let errors = 0;

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 5;
    for (let i = 0; i < userFolders.length; i += BATCH_SIZE) {
      const batch = userFolders.slice(i, i + BATCH_SIZE);
      
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(userFolders.length / BATCH_SIZE)}`);
      
      const results = await Promise.all(
        batch.map(async (folder) => {
          try {
            const success = await processUserFolder(folder);
            return success;
          } catch (error) {
            console.error(`Failed to process folder ${folder}:`, error);
            return false;
          }
        })
      );
      
      const batchSuccesses = results.filter(r => r).length;
      processed += batchSuccesses;
      errors += results.length - batchSuccesses;
      
      console.log(`Batch completed. Success: ${batchSuccesses}/${batch.length}`);
      console.log(`Overall progress: ${processed}/${userFolders.length} users processed`);
      
      // Add a delay between batches
      if (i + BATCH_SIZE < userFolders.length) {
        console.log(`Waiting 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final summary
    console.log('\n----------------------------------------');
    console.log('Import process completed');
    console.log('----------------------------------------');
    console.log(`Total users: ${userFolders.length}`);
    console.log(`Successfully processed: ${processed}`);
    console.log(`Errors: ${errors}`);
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the script
main().then(() => {
  console.log('Script execution completed');
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 