import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

export interface AppSettings {
  theme: 'light' | 'dark' | 'colorful';
  workbookPath: string;
  backupPath: string;
  updatedAt: string;
}

const SETTINGS_FILE = path.resolve(process.cwd(), 'settings.json');

export const DEFAULT_WORKBOOK_PATH = 'data/Markspen_Engineering_Central_Monitor.xlsx';
export const DEFAULT_BACKUP_PATH = 'data/Markspen_Engineering_Central_Monitor.backup.xlsx';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  workbookPath: DEFAULT_WORKBOOK_PATH,
  backupPath: DEFAULT_BACKUP_PATH,
  updatedAt: new Date().toISOString()
};

export function readSettingsSync(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
      return DEFAULT_SETTINGS;
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const validThemes: Array<'light' | 'dark' | 'colorful'> = ['light', 'dark', 'colorful'];
    const theme = validThemes.includes(parsed.theme) ? parsed.theme : 'light';
    return {
      theme,
      workbookPath: parsed.workbookPath || DEFAULT_WORKBOOK_PATH,
      backupPath: parsed.backupPath || DEFAULT_BACKUP_PATH,
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await fsPromises.readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const validThemes: Array<'light' | 'dark' | 'colorful'> = ['light', 'dark', 'colorful'];
    const theme = validThemes.includes(parsed.theme) ? parsed.theme : 'light';
    return {
      theme,
      workbookPath: parsed.workbookPath || DEFAULT_WORKBOOK_PATH,
      backupPath: parsed.backupPath || DEFAULT_BACKUP_PATH,
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      await writeSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    console.error('[Settings] Error reading settings.json:', err);
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings().catch(() => DEFAULT_SETTINGS);
  const validThemes: Array<'light' | 'dark' | 'colorful'> = ['light', 'dark', 'colorful'];
  const updatedTheme = settings.theme && validThemes.includes(settings.theme)
    ? settings.theme
    : current.theme;

  const newSettings: AppSettings = {
    theme: updatedTheme,
    workbookPath: settings.workbookPath !== undefined && settings.workbookPath.trim() !== ''
      ? settings.workbookPath.trim()
      : current.workbookPath,
    backupPath: settings.backupPath !== undefined && settings.backupPath.trim() !== ''
      ? settings.backupPath.trim()
      : current.backupPath,
    updatedAt: new Date().toISOString()
  };

  await fsPromises.writeFile(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');
  return newSettings;
}
