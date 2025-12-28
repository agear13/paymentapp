#!/bin/bash

################################################################################
# Provvypay Production Environment Setup Script
################################################################################
#
# This script automates the production environment setup process.
# Run this on your production server or CI/CD pipeline.
#
# Usage: ./scripts/setup-production.sh
#
################################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
log_section() {
    echo ""
    echo -e "${CYAN}================================================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}================================================================================${NC}"
    echo ""
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        log_success "Node.js installed: $NODE_VERSION"
    else
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        log_success "npm installed: $NPM_VERSION"
    else
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check PostgreSQL client
    if command -v psql &> /dev/null; then
        PSQL_VERSION=$(psql --version)
        log_success "PostgreSQL client installed: $PSQL_VERSION"
    else
        log_warning "PostgreSQL client not found (optional)"
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        log_success "Git installed: $GIT_VERSION"
    else
        log_warning "Git not found"
    fi
}

# Install dependencies
install_dependencies() {
    log_section "Installing Dependencies"
    
    log_info "Installing Node.js packages..."
    npm ci --production
    
    log_success "Dependencies installed"
}

# Setup environment
setup_environment() {
    log_section "Setting Up Environment"
    
    if [ ! -f .env.production ]; then
        log_warning ".env.production not found"
        
        if [ -f .env.production.template ]; then
            log_info "Copying template..."
            cp .env.production.template .env.production
            chmod 600 .env.production
            log_success ".env.production created from template"
            log_warning "⚠️  You must fill in all values before continuing!"
            exit 1
        else
            log_error ".env.production.template not found"
            exit 1
        fi
    else
        log_success ".env.production exists"
    fi
    
    # Secure the file
    chmod 600 .env.production
    log_success "Environment file permissions set to 600"
}

# Generate Prisma client
generate_prisma() {
    log_section "Generating Prisma Client"
    
    log_info "Generating Prisma client..."
    npx prisma generate
    
    log_success "Prisma client generated"
}

# Run database migrations
run_migrations() {
    log_section "Running Database Migrations"
    
    log_info "Checking database connection..."
    
    # Test database connection
    if npx prisma db push --skip-generate --preview-feature &> /dev/null; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database"
        log_info "Check DATABASE_URL in .env.production"
        exit 1
    fi
    
    log_info "Running migrations..."
    npx prisma migrate deploy
    
    log_success "Migrations completed"
}

# Validate environment
validate_environment() {
    log_section "Validating Environment Configuration"
    
    if [ -f scripts/validate-env.js ]; then
        node scripts/validate-env.js
    else
        log_warning "Validation script not found, skipping..."
    fi
}

# Build application
build_application() {
    log_section "Building Application"
    
    log_info "Running production build..."
    npm run build
    
    log_success "Application built successfully"
}

# Run health checks
run_health_checks() {
    log_section "Running Health Checks"
    
    # Start application in background
    log_info "Starting application..."
    npm run start &
    APP_PID=$!
    
    # Wait for application to start
    log_info "Waiting for application to start..."
    sleep 10
    
    # Check if application is running
    if ps -p $APP_PID > /dev/null; then
        log_success "Application is running (PID: $APP_PID)"
        
        # Try to hit health endpoint
        if command -v curl &> /dev/null; then
            log_info "Checking health endpoint..."
            
            if curl -f http://localhost:3000/api/health &> /dev/null; then
                log_success "Health check passed"
            else
                log_warning "Health endpoint not responding"
            fi
        fi
        
        # Stop the test instance
        log_info "Stopping test instance..."
        kill $APP_PID
        wait $APP_PID 2>/dev/null || true
        log_success "Test instance stopped"
    else
        log_error "Application failed to start"
        exit 1
    fi
}

# Print completion message
print_completion() {
    log_section "Setup Complete"
    
    echo ""
    log_success "🎉 Production environment setup completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "  1. Review .env.production and fill in all values"
    echo "  2. Run: npm run validate-env"
    echo "  3. Run: npm run start"
    echo "  4. Monitor logs and errors"
    echo ""
    log_info "For deployment:"
    echo "  - See: PRODUCTION_SETUP_GUIDE.md"
    echo "  - See: PRODUCTION_DEPLOYMENT_CHECKLIST.md"
    echo ""
    log_warning "⚠️  Before going live:"
    echo "  - Complete all items in PRODUCTION_DEPLOYMENT_CHECKLIST.md"
    echo "  - Test all payment flows"
    echo "  - Verify all integrations"
    echo "  - Set up monitoring and alerts"
    echo ""
}

# Main execution
main() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                                           ║${NC}"
    echo -e "${CYAN}║         🚀 Provvypay Production Environment Setup                        ║${NC}"
    echo -e "${CYAN}║                                                                           ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Run setup steps
    check_prerequisites
    install_dependencies
    setup_environment
    generate_prisma
    
    # Ask before running migrations
    echo ""
    read -p "Run database migrations? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_migrations
    else
        log_warning "Skipping database migrations"
    fi
    
    # Validate environment
    validate_environment
    
    # Build application
    build_application
    
    # Ask before running health checks
    echo ""
    read -p "Run health checks? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_health_checks
    else
        log_warning "Skipping health checks"
    fi
    
    print_completion
}

# Run main function
main





