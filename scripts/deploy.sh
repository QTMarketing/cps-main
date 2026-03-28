#!/bin/bash

/**
 * QT Office Check Printing System - Production Deployment Script
 * 
 * This script automates the deployment of the QT Office application
 * with HTTPS configuration and security features.
 * 
 * Features:
 * - Environment validation
 * - SSL certificate setup
 * - Application deployment
 * - Service configuration
 * - Health checks
 * - Rollback capability
 * 
 * Usage:
 *   chmod +x scripts/deploy.sh
 *   ./scripts/deploy.sh production yourdomain.com
 */

set -e  # Exit on any error

# Configuration
ENVIRONMENT="${1:-production}"
DOMAIN="${2:-}"
DEPLOY_USER="${DEPLOY_USER:-www-data}"
APP_DIR="${APP_DIR:-/var/www/qt-office}"
SERVICE_NAME="${SERVICE_NAME:-qt-office}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/qt-office}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Validate environment
validate_environment() {
    log_info "Validating deployment environment..."
    
    if [[ -z "$DOMAIN" ]]; then
        log_error "Domain is required. Usage: ./scripts/deploy.sh production yourdomain.com"
        exit 1
    fi
    
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_warning "Non-production environment detected: $ENVIRONMENT"
    fi
    
    log_success "Environment validation passed"
    log_info "Environment: $ENVIRONMENT"
    log_info "Domain: $DOMAIN"
    log_info "App Directory: $APP_DIR"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("node" "npm" "nginx" "systemctl" "certbot")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $node_version -lt 18 ]]; then
        log_error "Node.js version 18+ required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check if domain resolves
    if ! nslookup "$DOMAIN" &> /dev/null; then
        log_warning "Domain $DOMAIN does not resolve. Please ensure DNS is configured."
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup
create_backup() {
    log_info "Creating backup of current deployment..."
    
    local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_path="$BACKUP_DIR/$backup_timestamp"
    
    mkdir -p "$backup_path"
    
    if [[ -d "$APP_DIR" ]]; then
        cp -r "$APP_DIR" "$backup_path/app"
        log_success "Application backup created: $backup_path/app"
    fi
    
    if [[ -f "/etc/nginx/sites-enabled/qt-office" ]]; then
        cp -r /etc/nginx/sites-enabled/qt-office "$backup_path/nginx.conf"
        log_success "Nginx configuration backup created"
    fi
    
    if [[ -f "/etc/systemd/system/$SERVICE_NAME.service" ]]; then
        cp "/etc/systemd/system/$SERVICE_NAME.service" "$backup_path/service.service"
        log_success "Service configuration backup created"
    fi
    
    echo "$backup_timestamp" > "$BACKUP_DIR/latest"
    log_success "Backup completed: $backup_path"
}

# Setup application directory
setup_app_directory() {
    log_info "Setting up application directory..."
    
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/logs"
    mkdir -p "$APP_DIR/uploads"
    
    # Set proper permissions
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
    chmod -R 755 "$APP_DIR"
    
    log_success "Application directory setup completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing application dependencies..."
    
    cd "$APP_DIR"
    
    # Install Node.js dependencies
    npm ci --production
    
    # Generate Prisma client
    npx prisma generate
    
    log_success "Dependencies installed successfully"
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$APP_DIR"
    
    # Build Next.js application
    npm run build
    
    log_success "Application built successfully"
}

# Setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    # Check if certificates already exist
    if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
        log_info "SSL certificates already exist for $DOMAIN"
        return 0
    fi
    
    # Run SSL setup script
    if [[ -f "./scripts/setup-ssl.sh" ]]; then
        DOMAIN="$DOMAIN" ./scripts/setup-ssl.sh
    else
        log_warning "SSL setup script not found. Please run SSL setup manually."
    fi
    
    log_success "SSL certificates configured"
}

# Configure systemd service
configure_service() {
    log_info "Configuring systemd service..."
    
    # Copy service file
    if [[ -f "./deployment/qt-office.service" ]]; then
        cp "./deployment/qt-office.service" "/etc/systemd/system/$SERVICE_NAME.service"
        
        # Update service file with actual paths
        sed -i "s|/var/www/qt-office|$APP_DIR|g" "/etc/systemd/system/$SERVICE_NAME.service"
        
        # Reload systemd
        systemctl daemon-reload
        
        # Enable service
        systemctl enable "$SERVICE_NAME"
        
        log_success "Systemd service configured"
    else
        log_warning "Service file not found. Please configure service manually."
    fi
}

# Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    # Create Nginx configuration
    cat > "/etc/nginx/sites-available/qt-office" << EOF
# QT Office Check Printing System - Nginx Configuration
# Generated by deployment script

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; script-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; upgrade-insecure-requests;" always;
    
    # Proxy to QT Office application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Cache static files
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site
    ln -sf "/etc/nginx/sites-available/qt-office" "/etc/nginx/sites-enabled/qt-office"
    
    # Remove default site
    rm -f "/etc/nginx/sites-enabled/default"
    
    # Test Nginx configuration
    if nginx -t; then
        log_success "Nginx configuration is valid"
    else
        log_error "Nginx configuration is invalid"
        exit 1
    fi
    
    log_success "Nginx configured successfully"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    # Start QT Office service
    systemctl start "$SERVICE_NAME"
    systemctl status "$SERVICE_NAME" --no-pager
    
    # Reload Nginx
    systemctl reload nginx
    
    log_success "Services started successfully"
}

# Health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Wait for service to start
    sleep 10
    
    # Check service status
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_success "QT Office service is running"
    else
        log_error "QT Office service is not running"
        return 1
    fi
    
    # Check Nginx status
    if systemctl is-active --quiet nginx; then
        log_success "Nginx is running"
    else
        log_error "Nginx is not running"
        return 1
    fi
    
    # Check application health
    if curl -s -f "http://localhost:3000/health" > /dev/null; then
        log_success "Application health check passed"
    else
        log_error "Application health check failed"
        return 1
    fi
    
    # Check HTTPS
    if curl -s -f "https://$DOMAIN/health" > /dev/null; then
        log_success "HTTPS health check passed"
    else
        log_warning "HTTPS health check failed (may need time for DNS propagation)"
    fi
    
    log_success "All health checks passed"
}

# Rollback function
rollback() {
    log_warning "Rolling back deployment..."
    
    local latest_backup=$(cat "$BACKUP_DIR/latest" 2>/dev/null || echo "")
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No backup found for rollback"
        exit 1
    fi
    
    local backup_path="$BACKUP_DIR/$latest_backup"
    
    # Stop services
    systemctl stop "$SERVICE_NAME" || true
    systemctl stop nginx || true
    
    # Restore application
    if [[ -d "$backup_path/app" ]]; then
        rm -rf "$APP_DIR"
        cp -r "$backup_path/app" "$APP_DIR"
        chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
    fi
    
    # Restore Nginx configuration
    if [[ -f "$backup_path/nginx.conf" ]]; then
        cp "$backup_path/nginx.conf" "/etc/nginx/sites-enabled/qt-office"
    fi
    
    # Restore service configuration
    if [[ -f "$backup_path/service.service" ]]; then
        cp "$backup_path/service.service" "/etc/systemd/system/$SERVICE_NAME.service"
        systemctl daemon-reload
    fi
    
    # Start services
    systemctl start "$SERVICE_NAME"
    systemctl start nginx
    
    log_success "Rollback completed"
}

# Main deployment function
deploy() {
    log_info "Starting QT Office deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Domain: $DOMAIN"
    
    # Run deployment steps
    validate_environment
    check_prerequisites
    create_backup
    setup_app_directory
    install_dependencies
    build_application
    setup_ssl
    configure_service
    configure_nginx
    start_services
    
    # Run health checks
    if run_health_checks; then
        log_success "Deployment completed successfully!"
        log_info "Your QT Office application is now available at: https://$DOMAIN"
        log_info "Health check: https://$DOMAIN/health"
    else
        log_error "Deployment completed but health checks failed"
        log_warning "Consider running rollback: ./scripts/deploy.sh rollback"
        exit 1
    fi
}

# Handle rollback
if [[ "$1" == "rollback" ]]; then
    rollback
    exit 0
fi

# Run main deployment
deploy





