# Dashboard Quick Reference

## Navigation Structure

### Main Routes
```
/dashboard                              # Main dashboard
/dashboard/payment-links                # Payment links list
/dashboard/ledger                       # Ledger view
/dashboard/transactions                 # Transactions view
/dashboard/settings/organization        # Organization settings
/dashboard/settings/merchant            # Merchant settings
/dashboard/settings/team                # Team management
/dashboard/settings/integrations        # Integrations
/onboarding                             # Organization onboarding
```

## Components

### Layout Components
- `AppSidebar` - Main navigation sidebar
- `AppHeader` - Top header with org switcher
- `OrganizationSwitcher` - Dropdown for switching orgs
- `BreadcrumbNav` - Dynamic breadcrumb navigation

### Form Components
- `OrganizationSettingsForm` - Edit organization profile
- `MerchantSettingsForm` - Configure payment settings
- `OnboardingForm` - New organization setup

## API Endpoints

### Organizations
```typescript
// List organizations
GET /api/organizations
Response: { data: Organization[] }

// Create organization
POST /api/organizations
Body: { name: string, clerkOrgId: string }
Response: { data: Organization }

// Get organization
GET /api/organizations/[id]
Response: { data: Organization }

// Update organization
PATCH /api/organizations/[id]
Body: { name: string }
Response: { data: Organization }

// Delete organization
DELETE /api/organizations/[id]
Response: { data: { success: true } }
```

### Merchant Settings
```typescript
// List settings
GET /api/merchant-settings?organizationId=xxx
Response: { data: MerchantSettings[] }

// Create settings
POST /api/merchant-settings
Body: {
  organizationId: string
  displayName: string
  defaultCurrency: string
  stripeAccountId?: string
  hederaAccountId?: string
}
Response: { data: MerchantSettings }

// Get settings
GET /api/merchant-settings/[id]
Response: { data: MerchantSettings }

// Update settings
PATCH /api/merchant-settings/[id]
Body: Partial<MerchantSettings>
Response: { data: MerchantSettings }

// Delete settings
DELETE /api/merchant-settings/[id]
Response: { data: { success: true } }
```

## Form Validation

### Organization Schema
```typescript
{
  name: string (min: 2, max: 255)
}
```

### Merchant Settings Schema
```typescript
{
  displayName: string (min: 2, max: 255)
  defaultCurrency: string (length: 3) // ISO 4217
  stripeAccountId?: string (starts with "acct_")
  hederaAccountId?: string (format: "0.0.xxxxx")
}
```

### Onboarding Schema
```typescript
{
  organizationName: string (min: 2, max: 255)
  displayName: string (min: 2, max: 255)
  defaultCurrency: string (length: 3)
}
```

## Supported Currencies

```typescript
const currencies = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
];
```

## Usage Examples

### Creating an Organization
```typescript
const response = await fetch('/api/organizations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Acme Corp',
    clerkOrgId: 'org_xxxxxxxxxxxxx',
  }),
});
const { data } = await response.json();
```

### Updating Merchant Settings
```typescript
const response = await fetch(`/api/merchant-settings/${settingsId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    displayName: 'Acme Corporation',
    defaultCurrency: 'USD',
    stripeAccountId: 'acct_xxxxxxxxxxxxx',
    hederaAccountId: '0.0.12345',
  }),
});
const { data } = await response.json();
```

### Using Forms
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { /* ... */ },
});

async function onSubmit(data) {
  // API call
  toast.success('Settings updated!');
}
```

## Styling Patterns

### Page Layout
```tsx
<div className="space-y-6">
  <div>
    <h1 className="text-3xl font-bold tracking-tight">Title</h1>
    <p className="text-muted-foreground">Description</p>
  </div>
  {/* Content */}
</div>
```

### Card Layout
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Form Layout
```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Label</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormDescription>Help text</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Submit</Button>
  </form>
</Form>
```

## Common Patterns

### Loading State
```tsx
const [isLoading, setIsLoading] = useState(false);

<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Submit
</Button>
```

### Toast Notifications
```tsx
import { toast } from 'sonner';

toast.success('Success message');
toast.error('Error message');
toast.info('Info message');
```

### Empty State
```tsx
<div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
  No data yet. Create your first item to get started.
</div>
```

## Authentication

### Protected Routes
All dashboard routes are automatically protected by the layout:

```tsx
// src/app/(dashboard)/layout.tsx
const user = await getCurrentUser();
if (!user) {
  redirect('/auth/login');
}
```

### API Authentication
```tsx
const user = await getCurrentUser();
if (!user) {
  return apiError('Unauthorized', 401);
}
```

## Utilities

### cn() Function
```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  condition && 'conditional-classes',
  className
)} />
```

### API Response Format
```typescript
// Success
apiResponse(data, statusCode = 200)
// Returns: { data, success: true }

// Error
apiError(message, statusCode = 500)
// Returns: { error: message, success: false }
```

## Next Steps

1. Implement Clerk organization integration
2. Add real data fetching to forms
3. Implement permission checks
4. Add team member management
5. Build payment link creation flow













