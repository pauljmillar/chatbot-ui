-- Create new table for account API keys
CREATE TABLE account_api_keys (
    -- ID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- RELATIONSHIPS
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- METADATA
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- API KEYS
    openai_api_key TEXT,
    openai_organization_id TEXT,
    anthropic_api_key TEXT,
    google_gemini_api_key TEXT,
    mistral_api_key TEXT,
    groq_api_key TEXT,
    perplexity_api_key TEXT,
    azure_openai_api_key TEXT,
    openrouter_api_key TEXT,
    azure_openai_endpoint TEXT,
    azure_openai_35_turbo_id TEXT,
    azure_openai_45_turbo_id TEXT,
    azure_openai_45_vision_id TEXT,
    azure_openai_embeddings_id TEXT
);

-- Add RLS policy
ALTER TABLE account_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account API keys"
    ON account_api_keys
    FOR SELECT
    USING (
        account_id IN (
            SELECT account_id 
            FROM account_members 
            WHERE user_id = auth.uid()
        )
    );

-- Only account admins can modify keys
CREATE POLICY "Account admins can modify API keys"
    ON account_api_keys
    FOR ALL
    USING (
        account_id IN (
            SELECT account_id 
            FROM account_members 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        account_id IN (
            SELECT account_id 
            FROM account_members 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );