import asyncio
import random
from datetime import datetime, timedelta
from supabase import create_client, Client

# Supabase credentials - update these with your actual credentials
SUPABASE_URL = "https://ozlkvubmlgcuezpttkwd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bGt2dWJtbGdjdWV6cHR0a3dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTM1NjQsImV4cCI6MjA4MTQyOTU2NH0.Wcyn0Nujt0lK2SxOpykS3sWa6uaHcrl5SFZFuJK_BVY"

# Test user data
TEST_USERS = [
    {
        "email": "test1@example.com",
        "password": "Test123!",
        "username": "alice_wonder",
        "real_name": "Alice Wonderland",

        "interests": ["Photography", "Travel", "Art", "Music"],
        "life_expectations": "I want to explore the world and capture beautiful moments through my lens.",
        "what_brought_you_here": "Looking for like-minded people who share my passion for photography.",
        "linkedin_link": "linkedin.com/in/alicewonder",
        "verified": True,
        "email_verified": True,
    },
    {
        "email": "test2@example.com",
        "password": "Test123!",
        "username": "bob_builder",
        "real_name": "Bob Builder",
        "interests": ["Technology", "Gaming", "Coding", "Fitness"],
        "life_expectations": "To create impactful software that helps people in their daily lives.",
        "what_brought_you_here": "Want to connect with other developers and gamers.",
        "linkedin_link": "linkedin.com/in/bobbuilder",
        "verified": True,
        "email_verified": True,
    },
    {
        "email": "test3@example.com",
        "password": "Test123!",
        "username": "charlie_dance",
        "real_name": "Charlie Dance",
        
        "interests": ["Dancing", "Yoga", "Fitness", "Music"],
        "life_expectations": "To inspire others through dance and help them find their rhythm.",
        "what_brought_you_here": "Looking for students and fellow dancers to collaborate with.",
        "linkedin_link": "linkedin.com/in/charliedance",
        "verified": False,
        "email_verified": True,
    },
    {
        "email": "test4@example.com",
        "password": "Test123!",
        "username": "diana_cook",
        "real_name": "Diana Cook",
        "interests": ["Food", "Cooking", "Photography", "Travel"],
        "life_expectations": "To open my own restaurant and share my love for cooking with the world.",
        "what_brought_you_here": "Looking for food enthusiasts and potential collaborators.",
        "linkedin_link": "linkedin.com/in/dianacook",
        "verified": True,
        "email_verified": True,
    },
    {
        "email": "test5@example.com",
        "password": "Test123!",
        "username": "eve_reader",
        "real_name": "Eve Reader",

        "interests": ["Reading", "Writing", "Art", "History"],
        "life_expectations": "To write a bestselling novel and inspire others through stories.",
        "what_brought_you_here": "Looking for book clubs and writing groups.",
        "linkedin_link": "linkedin.com/in/evereader",
        "verified": False,
        "email_verified": False,
    },
    {
        "email": "test6@example.com",
        "password": "Test123!",
        "username": "frank_music",
        "real_name": "Frank Music",
       "interests": ["Music", "Jazz", "Piano", "Composition"],
        "life_expectations": "To compose music that touches people's hearts and souls.",
        "what_brought_you_here": "Looking for fellow musicians and collaborators for my next album.",
        "linkedin_link": "linkedin.com/in/frankmusic",
        "verified": True,
        "email_verified": True,
    },
    {
        "email": "test7@example.com",
        "password": "Test123!",
        "username": "grace_art",
        "real_name": "Grace Art",
        "interests": ["Art", "Painting", "Sculpture", "Gallery"],
        "life_expectations": "To create meaningful art that sparks conversations and emotions.",
        "what_brought_you_here": "Seeking art enthusiasts and potential buyers for my works.",
        "linkedin_link": "linkedin.com/in/graceart",
        "verified": False,
        "email_verified": True,
    },
    {
        "email": "test8@example.com",
        "password": "Test123!",
        "username": "henry_fitness",
        "real_name": "Henry Fitness",
        
        "interests": ["Fitness", "Nutrition", "Health", "Sports"],
        "life_expectations": "To help 1000 people achieve their fitness goals and live healthier lives.",
        "what_brought_you_here": "Looking for clients who are serious about their fitness journey.",
        "linkedin_link": "linkedin.com/in/henryfitness",
        "verified": True,
        "email_verified": True,
    },
    {
        "email": "test9@example.com",
        "password": "Test123!",
        "username": "ivy_tech",
        "real_name": "Ivy Tech",
        "bio": "AI researcher and tech entrepreneur. Building the future!",
        "interests": ["AI", "Technology", "Startups", "Innovation"],
        "life_expectations": "To develop AI solutions that solve real-world problems.",
        "what_brought_you_here": "Connecting with other tech enthusiasts and potential co-founders.",
        "linkedin_link": "linkedin.com/in/ivytech",
        "verified": False,
        "email_verified": False,
    },
    {
        "email": "test10@example.com",
        "password": "Test123!",
        "username": "jack_travel",
        "real_name": "Jack Travel",
        "bio": "Travel blogger and adventure seeker. The world is my playground!",
        "interests": ["Travel", "Adventure", "Photography", "Blogging"],
        "life_expectations": "To visit every country in the world and share my experiences.",
        "what_brought_you_here": "Looking for travel buddies and fellow explorers.",
        "linkedin_link": "linkedin.com/in/jacktravel",
        "verified": True,
        "email_verified": True,
    },
]

async def create_test_users():
    """Create test users in Supabase"""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    created_users = []
    
    for user_data in TEST_USERS:
        try:
            # Step 1: Create auth user
            auth_response = supabase.auth.sign_up({
                "email": user_data["email"],
                "password": user_data["password"],
            })
            
            if auth_response.user is None:
                print(f"Failed to create auth user: {user_data['email']}")
                continue
            
            user_id = auth_response.user.id
            print(f"Created auth user: {user_data['email']} (ID: {user_id})")
            
            # Step 2: Create profile
            profile_data = {
                "id": user_id,
                "username": user_data["username"],
                "real_name": user_data["real_name"],
                "email": user_data["email"],
                "bio": user_data.get("bio"),
                "interests": user_data.get("interests", []),
                "life_expectations": user_data.get("life_expectations"),
                "what_brought_you_here": user_data.get("what_brought_you_here"),
                "linkedin_link": user_data.get("linkedin_link"),
                "verified": user_data.get("verified", False),
                "email_verified": user_data.get("email_verified", False),
                "login_count": random.randint(5, 100),
                "total_gifts_sent": random.randint(0, 15),
                "total_gifts_received": random.randint(0, 10),
                "like_count": random.randint(0, 50),
            }
            
            profile_response = supabase.table("profiles").insert(profile_data).execute()
            
            if profile_response.data:
                print(f"Created profile for: {user_data['username']}")
                created_users.append({
                    "id": user_id,
                    "email": user_data["email"],
                    "username": user_data["username"],
                })
            else:
                print(f"Failed to create profile for: {user_data['username']}")
                
        except Exception as e:
            print(f"Error creating user {user_data['email']}: {str(e)}")
    
    print(f"\nSuccessfully created {len(created_users)} test users!")
    print("\nLogin credentials:")
    for user in created_users:
        print(f"  - {user['email']} / Test123!")
    
    return created_users

async def create_test_references(user_ids):
    """Create sample references between test users"""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    reference_contents = [
        "Harika bir insan! Cok yardimsever ve samimi.",
        "Fotografcilik konusunda cok yetenekli, tavsiye ederim.",
        "Birlikte calismak cok keyifli, profesyonel ve duzgun birisi.",
        "Cok eglenceli ve pozitif biri, her zaman guler yuzlu.",
        "Kod yazma konusunda cok bilgili, cok sey ogrendim.",
    ]
    
    try:
        for i, from_id in enumerate(user_ids):
            for j, to_id in enumerate(user_ids):
                if i != j and random.random() > 0.5:
                    reference_data = {
                        "from_user_id": from_id,
                        "to_user_id": to_id,
                        "content": random.choice(reference_contents),
                        "rating": random.randint(3, 5),
                        "created_at": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
                    }
                    
                    supabase.table("references_data").insert(reference_data).execute()
        
        print("Created sample references between users")
    except Exception as e:
        print(f"Error creating references: {str(e)}")

if __name__ == "__main__":
    print("Creating test users...\n")
    users = asyncio.run(create_test_users())
    
    if users:
        user_ids = [u["id"] for u in users]
        print("\nCreating sample references...")
        asyncio.run(create_test_references(user_ids))
