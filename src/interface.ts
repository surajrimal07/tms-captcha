export enum ResultTypes {
  Success,
  LowConfidence,
  InvalidLength,
}

export interface SolveResult {
  type: ResultTypes;
  value?: string;
}

export interface KindEntry {
  write_name: string;
  data_path: string;
}

export interface Account {
  type: "tms" | "meroshare";
  broker: number;
  alias: string;
  username: string;
  password: string;
  isPrimary: boolean;
}

//meroshare enums
export enum FormSelectors {
  FORM = 'form[name="loginForm"]',
  USERNAME = 'input[name="username"]',
  PASSWORD = 'input[name="password"]',
  DP_SELECT = 'select[name="dp"]',
  DP_OPTIONS = 'select[name="dp"] option',
  LOGIN_BUTTON = 'button[type="submit"]',
  SELECT2_CONTAINER = ".select2-container",
  SELECT2_DROPDOWN = ".select2-dropdown",
  SELECT2_SELECTION = ".select2-selection",
  SELECT2_RESULTS = ".select2-results__options",
}

export interface Config {
  readonly MAX_RETRIES: number;
  readonly RETRY_DELAY: number;
  readonly INITIAL_DELAY: number;
  readonly SELECTORS: typeof FormSelectors;
}

export interface Credentials {
  readonly dp: string;
  readonly username: string;
  readonly password: string;
}

export interface Select2Instance {
  trigger(event: string, data: unknown): void;
}

export interface AngularComponent {
  writeValue(value: unknown): void;
  onChange(value: unknown): void;
}

export const CONFIG: Readonly<Config> = {
  MAX_RETRIES: 5,
  RETRY_DELAY: 100,
  INITIAL_DELAY: 300,
  SELECTORS: FormSelectors,
};

export const MEROSHAREDASHBOARD_PATTERN = /\/#\/dashboard$/;
export const ANALYTICS_ENDPOINT =
  "https://surajr.com.np/api/logincount?action=receive" as const;
export const MEROSHARE_LOGIN_URL = "meroshare.cdsc.com.np/#/login" as const;
export const TMS_DASHBOARD_PATTERN = /\/tms\/client\/dashboard/;
