#!/usr/bin/env node
/**
 * Interactive Webhook Diagnostic Tool
 * Helps identify why webhooks aren't working
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔍 STRIPE WEBHOOK DIAGNOSTIC TOOL\n');
console.log('='.repeat(60));
console.log('\nThis tool will help identify why your webhooks aren\'t working.\n');

const questions = [
  {
    id: 'mode',
    question: 'Are you testing with TEST mode or LIVE mode? (test/live)',
    validate: (answer) => ['test', 'live'].includes(answer.toLowerCase())
  },
  {
    id: 'endpoint_exists',
    question: 'Do you see a webhook endpoint in Stripe Dashboard? (yes/no)',
    validate: (answer) => ['yes', 'no', 'y', 'n'].includes(answer.toLowerCase())
  },
  {
    id: 'endpoint_url',
    question: 'What is the webhook endpoint URL? (paste it here)',
    depends: (answers) => answers.endpoint_exists.toLowerCase().startsWith('y')
  },
  {
    id: 'events_configured',
    question: 'How many events are configured on the webhook? (number or "none")',
    depends: (answers) => answers.endpoint_exists.toLowerCase().startsWith('y')
  },
  {
    id: 'includes_payment_intent',
    question: 'Does it include "payment_intent.succeeded" event? (yes/no)',
    depends: (answers) => answers.endpoint_exists.toLowerCase().startsWith('y') && answers.events_configured !== 'none' && answers.events_configured !== '0'
  },
  {
    id: 'test_webhook_response',
    question: 'When you send a test webhook, what status code do you get? (200/401/404/500/other)',
    depends: (answers) => answers.endpoint_exists.toLowerCase().startsWith('y')
  },
  {
    id: 'recent_deliveries',
    question: 'Do you see any deliveries in "Recent deliveries"? (yes/no)',
    depends: (answers) => answers.endpoint_exists.toLowerCase().startsWith('y')
  },
  {
    id: 'webhook_secret_value',
    question: 'In Render, what is STRIPE_WEBHOOK_SECRET set to? (disabled/whsec_.../not set)',
  },
  {
    id: 'render_logs',
    question: 'Do you see webhook logs in Render when you make a payment? (yes/no)',
  }
];

async function askQuestion(q) {
  return new Promise((resolve) => {
    rl.question(`\n${q.question}\n> `, (answer) => {
      if (q.validate && !q.validate(answer)) {
        console.log('⚠️  Invalid answer, please try again.');
        resolve(askQuestion(q));
      } else {
        resolve(answer);
      }
    });
  });
}

async function runDiagnostic() {
  const answers = {};
  
  for (const question of questions) {
    if (question.depends && !question.depends(answers)) {
      continue;
    }
    answers[question.id] = await askQuestion(question);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 DIAGNOSIS:\n');
  
  // Analyze answers
  const issues = [];
  const fixes = [];
  
  // Check if endpoint exists
  if (!answers.endpoint_exists || answers.endpoint_exists.toLowerCase().startsWith('n')) {
    issues.push('❌ CRITICAL: No webhook endpoint configured in Stripe');
    fixes.push({
      priority: 'HIGH',
      fix: 'Create webhook endpoint',
      steps: [
        '1. Go to https://dashboard.stripe.com/test/webhooks',
        '2. Click "+ Add endpoint"',
        '3. URL: https://your-app.onrender.com/api/stripe/webhook',
        '4. Select events: payment_intent.succeeded, checkout.session.completed',
        '5. Copy the signing secret and add to Render as STRIPE_WEBHOOK_SECRET'
      ]
    });
  } else {
    // Endpoint exists, check configuration
    
    // Check events
    if (answers.events_configured === 'none' || answers.events_configured === '0') {
      issues.push('❌ CRITICAL: Webhook has NO events configured');
      fixes.push({
        priority: 'HIGH',
        fix: 'Add events to webhook',
        steps: [
          '1. Go to your webhook in Stripe Dashboard',
          '2. Click "..." → "Update details"',
          '3. Click "+ Select events"',
          '4. Add: payment_intent.succeeded, checkout.session.completed',
          '5. Click "Update endpoint"'
        ]
      });
    } else if (answers.includes_payment_intent && answers.includes_payment_intent.toLowerCase().startsWith('n')) {
      issues.push('❌ CRITICAL: Missing payment_intent.succeeded event');
      fixes.push({
        priority: 'HIGH',
        fix: 'Add payment_intent.succeeded event',
        steps: [
          '1. Go to your webhook in Stripe Dashboard',
          '2. Click "..." → "Update details"',
          '3. Click "+ Select events"',
          '4. Search for and add: payment_intent.succeeded',
          '5. Click "Update endpoint"'
        ]
      });
    }
    
    // Check test webhook response
    if (answers.test_webhook_response === '401') {
      issues.push('⚠️  Webhook signature verification failing (401)');
      fixes.push({
        priority: 'HIGH',
        fix: 'Update webhook secret in Render',
        steps: [
          '1. In Stripe webhook, click "Reveal" under Signing secret',
          '2. Copy the secret (starts with whsec_)',
          '3. In Render Environment, update STRIPE_WEBHOOK_SECRET',
          '4. Wait for redeployment'
        ]
      });
    } else if (answers.test_webhook_response === '404') {
      issues.push('⚠️  Webhook endpoint URL is wrong (404)');
      fixes.push({
        priority: 'HIGH',
        fix: 'Update webhook URL in Stripe',
        steps: [
          '1. Verify your Render app URL',
          '2. In Stripe webhook, click "..." → "Update details"',
          '3. Update URL to: https://your-app.onrender.com/api/stripe/webhook',
          '4. Click "Update endpoint"'
        ]
      });
    } else if (answers.test_webhook_response === '500') {
      issues.push('⚠️  Application error processing webhook (500)');
      fixes.push({
        priority: 'MEDIUM',
        fix: 'Check Render logs for errors',
        steps: [
          '1. Go to Render Dashboard → Logs',
          '2. Look for error messages when webhook fires',
          '3. Share the error messages for further help'
        ]
      });
    }
    
    // Check recent deliveries
    if (answers.recent_deliveries && answers.recent_deliveries.toLowerCase().startsWith('n')) {
      issues.push('⚠️  No recent webhook deliveries');
      fixes.push({
        priority: 'MEDIUM',
        fix: 'Verify events are triggering',
        steps: [
          '1. Make a test payment',
          '2. Check Stripe Payments to verify payment succeeded',
          '3. Check webhook Recent deliveries immediately after',
          '4. If still no deliveries, events might not be configured'
        ]
      });
    }
  }
  
  // Check webhook secret
  if (answers.webhook_secret_value && answers.webhook_secret_value.toLowerCase() === 'disabled') {
    issues.push('❌ CRITICAL: STRIPE_WEBHOOK_SECRET is set to "disabled"');
    fixes.push({
      priority: 'HIGH',
      fix: 'Update STRIPE_WEBHOOK_SECRET in Render',
      steps: [
        '1. Get secret from Stripe webhook (click "Reveal")',
        '2. In Render Environment, update STRIPE_WEBHOOK_SECRET',
        '3. Replace "disabled" with actual secret (starts with whsec_)',
        '4. Save and wait for redeployment'
      ]
    });
  } else if (answers.webhook_secret_value && answers.webhook_secret_value.toLowerCase().includes('not set')) {
    issues.push('❌ CRITICAL: STRIPE_WEBHOOK_SECRET not set in Render');
    fixes.push({
      priority: 'HIGH',
      fix: 'Add STRIPE_WEBHOOK_SECRET to Render',
      steps: [
        '1. Get secret from Stripe webhook (click "Reveal")',
        '2. In Render Environment, add new variable',
        '3. Key: STRIPE_WEBHOOK_SECRET',
        '4. Value: whsec_xxxxx (from Stripe)',
        '5. Save and wait for redeployment'
      ]
    });
  }
  
  // Check Render logs
  if (answers.render_logs && answers.render_logs.toLowerCase().startsWith('n')) {
    issues.push('⚠️  No webhook logs appearing in Render');
    fixes.push({
      priority: 'HIGH',
      fix: 'This means webhooks are not reaching your app',
      steps: [
        '1. Verify webhook URL is correct',
        '2. Verify events are configured in Stripe',
        '3. Send test webhook from Stripe Dashboard',
        '4. Check Render logs immediately after'
      ]
    });
  }
  
  // Display results
  if (issues.length === 0) {
    console.log('✅ No obvious issues detected!');
    console.log('\nIf webhooks still not working, check:');
    console.log('  • Stripe Dashboard → Webhooks → Recent deliveries');
    console.log('  • Render logs for error messages');
    console.log('  • Make a new test payment and observe the flow');
  } else {
    console.log('Found ' + issues.length + ' issue(s):\n');
    issues.forEach(issue => console.log('  ' + issue));
    
    console.log('\n📝 FIXES NEEDED:\n');
    fixes.sort((a, b) => {
      const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priority[a.priority] - priority[b.priority];
    });
    
    fixes.forEach((fix, index) => {
      console.log(`${index + 1}. [${fix.priority}] ${fix.fix}`);
      fix.steps.forEach(step => console.log('   ' + step));
      console.log('');
    });
  }
  
  console.log('='.repeat(60));
  console.log('\n💡 Next Step: Complete the highest priority fix and test again.\n');
  
  rl.close();
}

runDiagnostic().catch(console.error);

