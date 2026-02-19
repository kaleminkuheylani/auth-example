-- Supabase Schema for Dating App Verification
-- Run this in Supabase SQL Editor

-- Profiles table (extends auth.users) - IMMUTABLE after creation
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    bio TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    interests TEXT[] DEFAULT '{}',
    like_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_locked BOOLEAN DEFAULT FALSE -- Prevents updates after initial setup
);

-- User verifications table (stores face verification data)
CREATE TABLE IF NOT EXISTS user_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    face_image TEXT NOT NULL, -- Base64 encoded face image
    face_descriptor JSONB, -- MediaPipe face descriptor
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE
);

-- References table (user references/endorsements)
CREATE TABLE IF NOT EXISTS references_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id) -- One reference per user pair
);

-- Likes table (tracks profile likes)
CREATE TABLE IF NOT EXISTS likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id) -- One like per user pair
);

-- Gift packages table (predefined gift amounts)
CREATE TABLE IF NOT EXISTS gift_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount INTEGER NOT NULL CHECK (amount IN (50, 150, 250, 500)),
    name TEXT NOT NULL,
    description TEXT,
    commission_rate DECIMAL(4,2) DEFAULT 0.20, -- 20% commission
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gifts table (gift transactions)
CREATE TABLE IF NOT EXISTS gifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES gift_packages(id),
    amount INTEGER NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    receiver_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User balances table (track gift earnings)
CREATE TABLE IF NOT EXISTS user_balances (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    balance DECIMAL(10,2) DEFAULT 0.00,
    total_received DECIMAL(10,2) DEFAULT 0.00,
    total_sent DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE references_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Prevent updates after profile is locked
CREATE POLICY "Users cannot update locked profiles"
    ON profiles FOR UPDATE
    USING (auth.uid() = id AND NOT is_locked);

-- User verifications policies
CREATE POLICY "Users can view own verification"
    ON user_verifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification"
    ON user_verifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- References policies
CREATE POLICY "References are viewable by everyone"
    ON references_data FOR SELECT
    USING (true);

CREATE POLICY "Users can create references"
    ON references_data FOR INSERT
    WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can delete own references"
    ON references_data FOR DELETE
    USING (auth.uid() = from_user_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone"
    ON likes FOR SELECT
    USING (true);

CREATE POLICY "Users can create likes"
    ON likes FOR INSERT
    WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can delete own likes"
    ON likes FOR DELETE
    USING (auth.uid() = from_user_id);

-- Gift packages policies (admin only insert/update, everyone can view)
CREATE POLICY "Gift packages are viewable by everyone"
    ON gift_packages FOR SELECT
    USING (true);

-- Gifts policies
CREATE POLICY "Gifts are viewable by sender or receiver"
    ON gifts FOR SELECT
    USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send gifts"
    ON gifts FOR INSERT
    WITH CHECK (auth.uid() = from_user_id);

-- User balances policies
CREATE POLICY "Users can view own balance"
    ON user_balances FOR SELECT
    USING (auth.uid() = user_id);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Function to lock profile after verification
CREATE OR REPLACE FUNCTION lock_profile_after_verification()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles 
    SET is_locked = true 
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to lock profile when verified
CREATE TRIGGER lock_profile_on_verification
    AFTER INSERT ON user_verifications
    FOR EACH ROW
    WHEN (NEW.is_verified = true)
    EXECUTE FUNCTION lock_profile_after_verification();

-- Function to update like_count when like is added
CREATE OR REPLACE FUNCTION increment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles 
    SET like_count = like_count + 1 
    WHERE id = NEW.to_user_id;
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
    UPDATE profiles 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.to_user_id;
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
