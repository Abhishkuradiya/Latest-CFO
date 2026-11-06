import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const LOCAL_SETTINGS_FILE = path.join(process.cwd(), 'src', 'data', 'system_settings.json');

function getLocalSettings() {
  try {
    if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
      const raw = fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

function saveLocalSettings(settings: any) {
  try {
    const dir = path.dirname(LOCAL_SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing local system_settings.json:', e);
  }
}

async function ensureSettingsTable() {
  if (db.isPgActive()) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT PRIMARY KEY DEFAULT 1,
          smtp_host VARCHAR(255),
          smtp_port INTEGER,
          smtp_encryption VARCHAR(50),
          smtp_sender_email VARCHAR(255),
          smtp_sender_name VARCHAR(255),
          smtp_user VARCHAR(255),
          smtp_pass TEXT,
          smtp_verified BOOLEAN DEFAULT FALSE,
          maintenance_mode BOOLEAN DEFAULT FALSE,
          multi_tenancy_enabled BOOLEAN DEFAULT TRUE,
          audit_logging BOOLEAN DEFAULT TRUE,
          rate_limit VARCHAR(50) DEFAULT '1000',
          llm_provider VARCHAR(100) DEFAULT 'omegaplus',
          llm_api_key TEXT DEFAULT '',
          llm_base_url VARCHAR(255) DEFAULT 'https://api.omegaplusapi.com',
          llm_default_model VARCHAR(100) DEFAULT 'claude-fable-5',
          llm_enabled_models TEXT DEFAULT '["claude-fable-5"]',
          llm_temperature NUMERIC DEFAULT 0.7,
          llm_max_tokens INTEGER DEFAULT 2048,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(100) DEFAULT 'omegaplus';
        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS llm_api_key TEXT DEFAULT '';
        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS llm_base_url VARCHAR(255) DEFAULT 'https://api.omegaplusapi.com';
        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS llm_default_model VARCHAR(100) DEFAULT 'claude-fable-5';
        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS llm_enabled_models TEXT DEFAULT '["claude-fable-5"]';
        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS llm_temperature NUMERIC DEFAULT 0.7;
        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS llm_max_tokens INTEGER DEFAULT 2048;
      `);
    } catch (e) {
      console.warn('System settings table check error:', e);
    }
  }
}

export async function GET() {
  try {
    await ensureSettingsTable();

    let settings: any = {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpEncryption: 'TLS',
      smtpSenderEmail: 'noreply@virtualcfo.com',
      smtpSenderName: 'Virtual CFO Platform',
      smtpUser: 'admin@virtualcfo.com',
      smtpPass: '',
      smtpVerified: false,
      maintenanceMode: false,
      multiTenancyEnabled: true,
      auditLogging: true,
      rateLimit: '1000',
      llmProvider: 'omegaplus',
      llmApiKey: '',
      llmBaseUrl: 'https://api.omegaplusapi.com',
      llmDefaultModel: 'claude-fable-5',
      llmEnabledModels: ['claude-fable-5'],
      llmTemperature: 0.7,
      llmMaxTokens: 2048
    };

    // Try local JSON cache first
    const local = getLocalSettings();
    if (local) {
      settings = { ...settings, ...local };
    }

    if (db.isPgActive()) {
      try {
        const res = await db.query('SELECT * FROM system_settings WHERE id = 1 LIMIT 1');
        if (res.rows.length > 0) {
          const row = res.rows[0];
          let parsedEnabled = settings.llmEnabledModels;
          try {
            if (row.llm_enabled_models) parsedEnabled = JSON.parse(row.llm_enabled_models);
          } catch (e) {}

          settings = {
            smtpHost: row.smtp_host || settings.smtpHost,
            smtpPort: row.smtp_port || settings.smtpPort,
            smtpEncryption: row.smtp_encryption || settings.smtpEncryption,
            smtpSenderEmail: row.smtp_sender_email || settings.smtpSenderEmail,
            smtpSenderName: row.smtp_sender_name || settings.smtpSenderName,
            smtpUser: row.smtp_user || settings.smtpUser,
            smtpPass: row.smtp_pass || '',
            smtpVerified: row.smtp_verified ?? false,
            maintenanceMode: row.maintenance_mode ?? false,
            multiTenancyEnabled: row.multi_tenancy_enabled ?? true,
            auditLogging: row.audit_logging ?? true,
            rateLimit: row.rate_limit || '1000',
            llmProvider: row.llm_provider || settings.llmProvider,
            llmApiKey: row.llm_api_key || settings.llmApiKey,
            llmBaseUrl: row.llm_base_url || settings.llmBaseUrl,
            llmDefaultModel: row.llm_default_model || settings.llmDefaultModel,
            llmEnabledModels: parsedEnabled,
            llmTemperature: row.llm_temperature ? parseFloat(row.llm_temperature) : settings.llmTemperature,
            llmMaxTokens: row.llm_max_tokens ? parseInt(row.llm_max_tokens) : settings.llmMaxTokens
          };
        }
      } catch (e) {
        console.warn('Postgres settings read fallback to local JSON:', e);
      }
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureSettingsTable();
    const body = await req.json();

    const {
      smtpHost,
      smtpPort,
      smtpEncryption,
      smtpSenderEmail,
      smtpSenderName,
      smtpUser,
      smtpPass,
      smtpVerified,
      maintenanceMode,
      multiTenancyEnabled,
      auditLogging,
      rateLimit,
      llmProvider,
      llmApiKey,
      llmBaseUrl,
      llmDefaultModel,
      llmEnabledModels,
      llmTemperature,
      llmMaxTokens
    } = body;

    const newSettings = {
      smtpHost: smtpHost || 'smtp.gmail.com',
      smtpPort: parseInt(smtpPort) || 587,
      smtpEncryption: smtpEncryption || 'TLS',
      smtpSenderEmail: smtpSenderEmail || 'noreply@virtualcfo.com',
      smtpSenderName: smtpSenderName || 'Virtual CFO Platform',
      smtpUser: smtpUser || '',
      smtpPass: smtpPass || '',
      smtpVerified: Boolean(smtpVerified),
      maintenanceMode: Boolean(maintenanceMode),
      multiTenancyEnabled: Boolean(multiTenancyEnabled),
      auditLogging: Boolean(auditLogging),
      rateLimit: rateLimit || '1000',
      llmProvider: llmProvider || 'omegaplus',
      llmApiKey: llmApiKey || '',
      llmBaseUrl: llmBaseUrl || 'https://api.omegaplusapi.com',
      llmDefaultModel: llmDefaultModel || 'claude-fable-5',
      llmEnabledModels: Array.isArray(llmEnabledModels) && llmEnabledModels.length > 0 ? llmEnabledModels : ['claude-fable-5'],
      llmTemperature: parseFloat(llmTemperature) || 0.7,
      llmMaxTokens: parseInt(llmMaxTokens) || 2048
    };

    // Save locally to JSON file
    saveLocalSettings(newSettings);

    if (db.isPgActive()) {
      try {
        await db.query(`
          INSERT INTO system_settings (
            id, smtp_host, smtp_port, smtp_encryption, smtp_sender_email, smtp_sender_name, 
            smtp_user, smtp_pass, smtp_verified, maintenance_mode, multi_tenancy_enabled, audit_logging, rate_limit,
            llm_provider, llm_api_key, llm_base_url, llm_default_model, llm_enabled_models, llm_temperature, llm_max_tokens, updated_at
          ) VALUES (
            1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            smtp_host = EXCLUDED.smtp_host,
            smtp_port = EXCLUDED.smtp_port,
            smtp_encryption = EXCLUDED.smtp_encryption,
            smtp_sender_email = EXCLUDED.smtp_sender_email,
            smtp_sender_name = EXCLUDED.smtp_sender_name,
            smtp_user = EXCLUDED.smtp_user,
            smtp_pass = EXCLUDED.smtp_pass,
            smtp_verified = EXCLUDED.smtp_verified,
            maintenance_mode = EXCLUDED.maintenance_mode,
            multi_tenancy_enabled = EXCLUDED.multi_tenancy_enabled,
            audit_logging = EXCLUDED.audit_logging,
            rate_limit = EXCLUDED.rate_limit,
            llm_provider = EXCLUDED.llm_provider,
            llm_api_key = EXCLUDED.llm_api_key,
            llm_base_url = EXCLUDED.llm_base_url,
            llm_default_model = EXCLUDED.llm_default_model,
            llm_enabled_models = EXCLUDED.llm_enabled_models,
            llm_temperature = EXCLUDED.llm_temperature,
            llm_max_tokens = EXCLUDED.llm_max_tokens,
            updated_at = NOW();
        `, [
          newSettings.smtpHost,
          newSettings.smtpPort,
          newSettings.smtpEncryption,
          newSettings.smtpSenderEmail,
          newSettings.smtpSenderName,
          newSettings.smtpUser,
          newSettings.smtpPass,
          newSettings.smtpVerified,
          newSettings.maintenanceMode,
          newSettings.multiTenancyEnabled,
          newSettings.auditLogging,
          newSettings.rateLimit,
          newSettings.llmProvider,
          newSettings.llmApiKey,
          newSettings.llmBaseUrl,
          newSettings.llmDefaultModel,
          JSON.stringify(newSettings.llmEnabledModels),
          newSettings.llmTemperature,
          newSettings.llmMaxTokens
        ]);
      } catch (e) {
        console.warn('Postgres system_settings write warning:', e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'System & LLM Gateway settings saved successfully!',
      settings: newSettings
    });
  } catch (err: any) {
    console.error('Failed to save settings:', err);
    return NextResponse.json({ success: false, message: 'Failed to save system settings' }, { status: 500 });
  }
}
