-- Supabase Schema for Kalipso Safety App
-- Run this in Supabase SQL Editor

-- Drop existing tables if needed (uncomment for fresh start)
-- DROP TABLE IF EXISTS gifts, gift_packages, likes, references_data, user_verifications, user_balances, profiles CASCADE;

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    real_name TEXT,
    email TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    bio TEXT,

    -- Gender field: 'male' | 'female' | 'other'
    -- Required for gender-based safety filtering
    gender TEXT CHECK (gender IN ('male', 'female', 'other')) DEFAULT NULL,

    interests TEXT[] DEFAULT '{}',
    life_expectations TEXT,
    what_brought_you_here TEXT,
    -- LinkedIn OAuth
    linkedin_link TEXT,
    linkedin_verified BOOLEAN DEFAULT FALSE,
    -- Profile visibility in recommendations
    -- Default TRUE: User appears in recommendations
    -- User can set FALSE to hide from recommendations (private mode)
    is_public_in_recommendations BOOLEAN DEFAULT TRUE,
    -- Link visibility settings (default: visible to all)
    show_linkedin BOOLEAN DEFAULT TRUE,
    -- Safety mode for women: only show verified men when TRUE
    safety_mode BOOLEAN DEFAULT FALSE,
    -- Engagement tracking for seriousness score
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    total_gifts_sent INTEGER DEFAULT 0,
    total_gifts_received INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_profile_edit TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- User verifications table (stores face verification data)
CREATE TABLE IF NOT EXISTS user_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    face_image TEXT NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE
);

-- References table
CREATE TABLE IF NOT EXISTS references_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id)
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id)
);

-- Gift packages table
CREATE TABLE IF NOT EXISTS gift_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    commission_rate DECIMAL(4,2) DEFAULT 0.20,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gifts table
CREATE TABLE IF NOT EXISTS gifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES gift_packages(id),
    amount INTEGER NOT NULL,
    commission_amount DECIMAL(10,2) DEFAULT 0,
    receiver_amount DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User balances table
CREATE TABLE IF NOT EXISTS user_balances (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    balance DECIMAL(10,2) DEFAULT 0.00,
    total_received DECIMAL(10,2) DEFAULT 0.00,
    total_sent DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blocked users table (for women's safety)
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Reports table (user-to-user reporting)
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('harassment', 'fake_profile', 'inappropriate', 'spam', 'other')),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table (for chat rooms)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    initiator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(initiator_id, recipient_id)
);

-- Messages table (for chat messages)
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE references_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users cannot update locked profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own verification" ON user_verifications;
DROP POLICY IF EXISTS "Users can insert own verification" ON user_verifications;
DROP POLICY IF EXISTS "References are viewable by everyone" ON references_data;
DROP POLICY IF EXISTS "Users can create references" ON references_data;
DROP POLICY IF EXISTS "Users can delete own references" ON references_data;
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;
DROP POLICY IF EXISTS "Users can create likes" ON likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON likes;
DROP POLICY IF EXISTS "Gift packages are viewable by everyone" ON gift_packages;
DROP POLICY IF EXISTS "Gifts are viewable by sender or receiver" ON gifts;
DROP POLICY IF EXISTS "Users can send gifts" ON gifts;
DROP POLICY IF EXISTS "Users can view own balance" ON user_balances;

-- Blocked users policies
CREATE POLICY "Users can view their own blocks"
    ON blocked_users FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
    ON blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id AND blocker_id != blocked_id);

CREATE POLICY "Users can unblock"
    ON blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- Reports policies
CREATE POLICY "Users can submit reports"
    ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id AND reporter_id != reported_id);

CREATE POLICY "Users can view own reports"
    ON reports FOR SELECT USING (auth.uid() = reporter_id);

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- User verifications policies
CREATE POLICY "Users can view own verification"
    ON user_verifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification"
    ON user_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- References policies
CREATE POLICY "References are viewable by everyone"
    ON references_data FOR SELECT USING (true);

CREATE POLICY "Users can create references"
    ON references_data FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can delete own references"
    ON references_data FOR DELETE USING (auth.uid() = from_user_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone"
    ON likes FOR SELECT USING (true);

CREATE POLICY "Users can create likes"
    ON likes FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can delete own likes"
    ON likes FOR DELETE USING (auth.uid() = from_user_id);

-- Gift packages policies
CREATE POLICY "Gift packages are viewable by everyone"
    ON gift_packages FOR SELECT USING (true);

-- Gifts policies
CREATE POLICY "Gifts are viewable by sender or receiver"
    ON gifts FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send gifts"
    ON gifts FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- User balances policies
CREATE POLICY "Users can view own balance"
    ON user_balances FOR SELECT USING (auth.uid() = user_id);

-- Conversations policies
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

CREATE POLICY "Users can view messages in their conversations"
    ON messages FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.initiator_id = auth.uid() OR conversations.recipient_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their conversations"
    ON messages FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.initiator_id = auth.uid() OR conversations.recipient_id = auth.uid())
        )
    );

CREATE POLICY "Users can update messages in their conversations"
    ON messages FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.initiator_id = auth.uid() OR conversations.recipient_id = auth.uid())
        )
    );

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS like_count_increment ON likes;
DROP TRIGGER IF EXISTS like_count_decrement ON likes;

-- Trigger for profiles updated_at
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Function to enforce weekly edit limit
CREATE OR REPLACE FUNCTION enforce_weekly_edit_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip check if last_profile_edit is NULL (first edit)
    IF OLD.last_profile_edit IS NOT NULL THEN
        -- Check if 7 days have passed since last edit
        IF OLD.last_profile_edit + INTERVAL '7 days' > NOW() THEN
            RAISE EXCEPTION 'Profile can only be edited once per week. Next edit available: %', 
                OLD.last_profile_edit + INTERVAL '7 days';
        END IF;
    END IF;
    
    -- Update last_profile_edit timestamp
    NEW.last_profile_edit := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger
DROP TRIGGER IF EXISTS enforce_weekly_edit ON profiles;

-- Trigger to enforce weekly edit limit
CREATE TRIGGER enforce_weekly_edit
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*) -- Only when actual changes made
    EXECUTE FUNCTION enforce_weekly_edit_limit();

-- Function to update like_count when like is added
CREATE OR REPLACE FUNCTION increment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET like_count = like_count + 1 WHERE id = NEW.to_user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for like increment
CREATE TRIGGER like_count_increment
    AFTER INSERT ON likes
    FOR EACH ROW
    EXECUTE FUNCTION increment_like_count();

-- Function to update like_count when like is removed
CREATE OR REPLACE FUNCTION decrement_like_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.to_user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for like decrement
CREATE TRIGGER like_count_decrement
    AFTER DELETE ON likes
    FOR EACH ROW
    EXECUTE FUNCTION decrement_like_count();

-- Function to process gift and update balances
CREATE OR REPLACE FUNCTION process_gift()
RETURNS TRIGGER AS $$
DECLARE
    v_commission_rate DECIMAL(4,2);
    v_commission_amount DECIMAL(10,2);
    v_receiver_amount DECIMAL(10,2);
BEGIN
    -- Get commission rate from package
    SELECT commission_rate INTO v_commission_rate
    FROM gift_packages WHERE id = NEW.package_id;
    
    IF v_commission_rate IS NULL THEN
        v_commission_rate := 0.20;
    END IF;
    
    -- Calculate amounts
    v_commission_amount := NEW.amount * v_commission_rate;
    v_receiver_amount := NEW.amount - v_commission_amount;
    
    -- Set calculated amounts
    NEW.commission_amount := v_commission_amount;
    NEW.receiver_amount := v_receiver_amount;
    
    -- Update sender's total_sent
    INSERT INTO user_balances (user_id, total_sent)
    VALUES (NEW.from_user_id, NEW.amount)
    ON CONFLICT (user_id)
    DO UPDATE SET 
        total_sent = user_balances.total_sent + NEW.amount,
        updated_at = NOW();
    
    -- Update receiver's balance and total_received
    INSERT INTO user_balances (user_id, balance, total_received)
    VALUES (NEW.to_user_id, v_receiver_amount, v_receiver_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET 
        balance = user_balances.balance + v_receiver_amount,
        total_received = user_balances.total_received + v_receiver_amount,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing gift trigger
DROP TRIGGER IF EXISTS process_gift_before_insert ON gifts;

-- Trigger to process gift before insert
CREATE TRIGGER process_gift_before_insert
    BEFORE INSERT ON gifts
    FOR EACH ROW
    EXECUTE FUNCTION process_gift();

-- Insert default gift packages
INSERT INTO gift_packages (amount, name, description, commission_rate) VALUES
    (50, 'flower', 'A beautiful rose', 0.20),
    (150, 'pink_heart', 'Cute teddy bear', 0.20),
    (250, 'red_heart', 'Sparkling diamond', 0.20),
    (500, 'ring', 'Royal crown', 0.20)
ON CONFLICT DO NOTHING;
