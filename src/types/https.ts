/**
 * HTTPS Configuration Types
 * 
 * TypeScript interfaces and types for HTTPS and security configuration
 */

export interface SecurityConfig {
  /** Whether to force HTTPS redirection */
  forceHttps: boolean;
  /** HSTS max age in seconds */
  hstsMaxAge: number;
  /** Whether to include subdomains in HSTS */
  includeSubDomains: boolean;
  /** Whether to enable HSTS preload */
  preload: boolean;
}

export interface ServerConfig {
  /** Server hostname */
  hostname: string;
  /** HTTP port */
  port: number;
  /** HTTPS port */
  httpsPort: number;
  /** Whether to force HTTPS */
  forceHttps: boolean;
  /** Development mode */
  dev: boolean;
}

export interface HelmetConfig {
  /** Content Security Policy configuration */
  contentSecurityPolicy: {
    directives: {
      defaultSrc: string[];
      styleSrc: string[];
      fontSrc: string[];
      imgSrc: string[];
      scriptSrc: string[];
      connectSrc: string[];
      frameSrc: string[];
      objectSrc: string[];
      upgradeInsecureRequests: string[];
    };
  };
  /** HTTP Strict Transport Security configuration */
  hsts: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  /** Frame guard configuration */
  frameguard: {
    action: 'deny' | 'sameorigin' | 'allow';
  };
  /** Hide X-Powered-By header */
  hidePoweredBy: boolean;
  /** Prevent MIME type sniffing */
  noSniff: boolean;
  /** XSS Protection */
  xssFilter: boolean;
  /** Referrer Policy */
  referrerPolicy: {
    policy: string;
  };
}

export interface SSLConfig {
  /** SSL certificate file path */
  certPath: string;
  /** SSL private key file path */
  keyPath: string;
  /** SSL certificate authority file path (optional) */
  caPath?: string;
  /** SSL passphrase (optional) */
  passphrase?: string;
}

export interface DeploymentConfig {
  /** Domain name */
  domain: string;
  /** SSL certificate provider */
  sslProvider: 'letsencrypt' | 'custom' | 'cloudflare';
  /** Let's Encrypt email */
  letsEncryptEmail?: string;
  /** SSL certificate paths */
  sslPaths?: SSLConfig;
  /** Reverse proxy configuration */
  reverseProxy?: {
    /** Whether to use reverse proxy */
    enabled: boolean;
    /** Proxy type */
    type: 'nginx' | 'apache' | 'cloudflare';
    /** Proxy configuration file path */
    configPath?: string;
  };
}

export interface EnvironmentConfig {
  /** Node environment */
  NODE_ENV: 'development' | 'production' | 'test';
  /** Server port */
  PORT: string;
  /** HTTPS port */
  HTTPS_PORT: string;
  /** Force HTTPS */
  FORCE_HTTPS: string;
  /** HSTS max age */
  HSTS_MAX_AGE: string;
  /** HSTS include subdomains */
  HSTS_INCLUDE_SUBDOMAINS: string;
  /** HSTS preload */
  HSTS_PRELOAD: string;
  /** Hostname */
  HOSTNAME: string;
  /** SSL certificate path */
  SSL_CERT_PATH?: string;
  /** SSL key path */
  SSL_KEY_PATH?: string;
  /** SSL CA path */
  SSL_CA_PATH?: string;
  /** SSL passphrase */
  SSL_PASSPHRASE?: string;
}

export interface HealthCheckResponse {
  /** Health status */
  status: 'healthy' | 'unhealthy';
  /** Timestamp */
  timestamp: string;
  /** Server uptime in seconds */
  uptime: number;
  /** Environment */
  environment: string;
  /** Application version */
  version: string;
  /** Additional metrics */
  metrics?: {
    /** Memory usage */
    memory: NodeJS.MemoryUsage;
    /** CPU usage */
    cpu: NodeJS.CpuUsage;
    /** Load average */
    loadAverage: number[];
  };
}

export interface SecurityHeaders {
  /** Strict Transport Security */
  'Strict-Transport-Security': string;
  /** Content Security Policy */
  'Content-Security-Policy': string;
  /** X-Frame-Options */
  'X-Frame-Options': string;
  /** X-Content-Type-Options */
  'X-Content-Type-Options': string;
  /** X-XSS-Protection */
  'X-XSS-Protection': string;
  /** Referrer Policy */
  'Referrer-Policy': string;
  /** Permissions Policy */
  'Permissions-Policy': string;
}

export interface RedirectConfig {
  /** Redirect status code */
  statusCode: 301 | 302 | 307 | 308;
  /** Redirect URL */
  url: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

export interface MiddlewareConfig {
  /** Whether middleware is enabled */
  enabled: boolean;
  /** Paths to exclude from middleware */
  excludePaths: string[];
  /** Security configuration */
  security: SecurityConfig;
  /** Redirect configuration */
  redirect: RedirectConfig;
}

export interface ServerMetrics {
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average response time */
  averageResponseTime: number;
  /** Memory usage */
  memoryUsage: NodeJS.MemoryUsage;
  /** CPU usage */
  cpuUsage: NodeJS.CpuUsage;
  /** Uptime */
  uptime: number;
}

export interface LogConfig {
  /** Log level */
  level: 'error' | 'warn' | 'info' | 'debug';
  /** Log format */
  format: 'json' | 'text';
  /** Whether to log to file */
  logToFile: boolean;
  /** Log file path */
  logFilePath?: string;
  /** Whether to log requests */
  logRequests: boolean;
  /** Whether to log errors */
  logErrors: boolean;
}

export interface ServerError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error stack */
  stack?: string;
  /** Request information */
  request?: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  /** Timestamp */
  timestamp: string;
}





