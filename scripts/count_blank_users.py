#!/usr/bin/env python3
"""
Count Blank Users Script

This script analyzes the database to count users with "blank" profiles 
in different categories:
1. Users without any posts
2. Users without avatar images
3. Users without bio information
4. Completely blank users (no posts, no avatar, no bio)
"""

import os
import sys
import json
import subprocess
from typing import Dict, Any, List, Optional

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

def count_users_without_posts() -> int:
    """Count users without any posts"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function countUsers() {
        try {
            const count = await prisma.user.count({
                where: {
                    posts: {
                        none: {}
                    }
                }
            });
            console.log(JSON.stringify({ count }));
        } catch (error) {
            console.error('Error counting users without posts:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countUsers();
    """
    
    result = run_prisma_script(script)
    count = result.get('count', 0) if result else 0
    print(f"Users without any posts: {count:,}")
    return count

def count_users_without_avatars() -> int:
    """Count users without avatar images"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function countUsers() {
        try {
            const count = await prisma.user.count({
                where: {
                    avatarUrl: null
                }
            });
            console.log(JSON.stringify({ count }));
        } catch (error) {
            console.error('Error counting users without avatars:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countUsers();
    """
    
    result = run_prisma_script(script)
    count = result.get('count', 0) if result else 0
    print(f"Users without avatar images: {count:,}")
    return count

def count_users_without_bios() -> int:
    """Count users without bio information"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function countUsers() {
        try {
            const count = await prisma.user.count({
                where: {
                    OR: [
                        { bio: null },
                        { bio: "" }
                    ]
                }
            });
            console.log(JSON.stringify({ count }));
        } catch (error) {
            console.error('Error counting users without bios:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countUsers();
    """
    
    result = run_prisma_script(script)
    count = result.get('count', 0) if result else 0
    print(f"Users without bio information: {count:,}")
    return count

def count_completely_blank_users() -> int:
    """Count completely blank users (no posts, no avatar, no bio)"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function countUsers() {
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
            console.error('Error counting completely blank users:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countUsers();
    """
    
    result = run_prisma_script(script)
    count = result.get('count', 0) if result else 0
    print(f"Completely blank users (no posts, no avatar, no bio): {count:,}")
    return count

def count_users_by_post_counts() -> List[Dict[str, Any]]:
    """Count users by post count ranges"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function countUsersByPostRanges() {
        try {
            // Use Prisma's native capabilities instead of raw SQL
            const usersWithPostCounts = await prisma.user.findMany({
                select: {
                    id: true,
                    _count: {
                        select: {
                            posts: true
                        }
                    }
                }
            });
            
            // Calculate the distribution
            const postCountRanges = {
                '0 posts': 0,
                '1-5 posts': 0,
                '6-20 posts': 0,
                '21-50 posts': 0,
                '51-100 posts': 0,
                'More than 100 posts': 0
            };
            
            // Categorize each user
            usersWithPostCounts.forEach(user => {
                const postCount = user._count.posts;
                
                if (postCount === 0) {
                    postCountRanges['0 posts']++;
                } else if (postCount >= 1 && postCount <= 5) {
                    postCountRanges['1-5 posts']++;
                } else if (postCount >= 6 && postCount <= 20) {
                    postCountRanges['6-20 posts']++;
                } else if (postCount >= 21 && postCount <= 50) {
                    postCountRanges['21-50 posts']++;
                } else if (postCount >= 51 && postCount <= 100) {
                    postCountRanges['51-100 posts']++;
                } else {
                    postCountRanges['More than 100 posts']++;
                }
            });
            
            // Convert to array format
            const userCounts = Object.entries(postCountRanges).map(([post_range, user_count]) => ({
                post_range,
                user_count
            }));
            
            console.log(JSON.stringify({ userCounts }));
        } catch (error) {
            console.error('Error counting users by post ranges:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countUsersByPostRanges();
    """
    
    result = run_prisma_script(script)
    user_counts = result.get('userCounts', []) if result else []
    
    print("\nUsers grouped by post count:")
    for row in user_counts:
        print(f"{row['post_range']}: {int(row['user_count']):,} users")
    
    return user_counts

def count_total_users() -> int:
    """Count total users in the system"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function countTotalUsers() {
        try {
            const count = await prisma.user.count();
            console.log(JSON.stringify({ count }));
        } catch (error) {
            console.error('Error counting total users:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    countTotalUsers();
    """
    
    result = run_prisma_script(script)
    count = result.get('count', 0) if result else 0
    print(f"\nTotal users in the system: {count:,}")
    return count

def get_blank_users_sample() -> List[Dict[str, Any]]:
    """Get a sample of completely blank users"""
    script = """
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function getSampleBlankUsers() {
        try {
            const users = await prisma.user.findMany({
                where: {
                    posts: { none: {} },
                    avatarUrl: null,
                    OR: [
                        { bio: null },
                        { bio: "" }
                    ]
                },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    createdAt: true
                },
                take: 5
            });
            console.log(JSON.stringify({ users }));
        } catch (error) {
            console.error('Error getting sample blank users:', error);
            console.log(JSON.stringify({ error: error.message }));
        } finally {
            await prisma.$disconnect();
        }
    }
    
    getSampleBlankUsers();
    """
    
    result = run_prisma_script(script)
    users = result.get('users', []) if result else []
    
    print("\nSample of completely blank users:")
    for user in users:
        display_name = user.get('displayName') or user.get('username')
        created_at = user.get('createdAt')
        print(f"- {display_name} ({user.get('id')}), created: {created_at}")
    
    return users

def main():
    """Main function to run the script"""
    print('='*47)
    print('           BLANK USER PROFILE REPORT          ')
    print('='*47)
    print()
    
    try:
        # Count users in different "blank" categories
        count_users_without_posts()
        count_users_without_avatars()
        count_users_without_bios()
        count_completely_blank_users()
        
        # Count users by post count ranges
        count_users_by_post_counts()
        
        # Count total users
        count_total_users()
        
        # Get sample of blank users
        get_blank_users_sample()
        
        print('\n' + '='*47)
        print('                 REPORT COMPLETE               ')
        print('='*47)
        
    except Exception as e:
        print(f"Error generating blank user report: {e}")

if __name__ == "__main__":
    main() 