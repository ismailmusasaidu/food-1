# Paystack Payment Integration Guide

This guide explains how to set up and use Paystack payment methods in your food delivery app. The app supports two Paystack-powered payment options:

1. **Wallet System** - Virtual bank accounts for deposits, withdrawals, and in-app payments
2. **Online Card Payments** - Direct card payments via Paystack gateway

## Prerequisites

1. A Paystack account (sign up at https://paystack.com)
2. Paystack Secret Key (found in your Paystack Dashboard under Settings > API Keys)
3. Your app deployed with Supabase Edge Functions

## Payment Methods Overview

### 1. Wallet Payment
- Users create a virtual bank account
- Transfer money to the account
- Pay for orders from wallet balance
- Withdraw funds to any Nigerian bank account

### 2. Online Card Payment (Paystack Gateway)
- Direct card payment at checkout
- Supports all major Nigerian banks
- Instant payment confirmation
- Secure payment processing

### 3. Cash on Delivery
- Traditional cash payment option
- Payment collected by delivery rider

### 4. Bank Transfer
- Manual bank transfer option
- Requires payment confirmation

## Setup Instructions

### Step 1: Configure Paystack Secret Key

The Paystack secret key is already configured automatically in your Supabase project. No manual configuration is needed.

### Step 2: Configure Webhooks

For the wallet system to receive instant deposit notifications, set up a webhook:

1. Go to your Paystack Dashboard
2. Navigate to **Settings > Webhooks**
3. Click **Add Endpoint**
4. Enter your webhook URL:
   ```
   https://[YOUR-PROJECT-REF].supabase.co/functions/v1/wallet-webhook
   ```
   Replace `[YOUR-PROJECT-REF]` with your Supabase project reference ID

5. Select the following events:
   - `charge.success`

6. Click **Save**

## Using Wallet Payment

### Creating a Wallet

1. Log in to the app
2. Go to the **Profile** tab
3. Scroll to the Wallet section
4. Click **Create Wallet**
5. A virtual bank account will be generated instantly

### Making a Deposit

After creating your wallet, you'll see:
- **Bank Name** (e.g., Wema Bank)
- **Account Number** (10-digit NUBAN)
- **Account Name** (Your name)

Transfer money from any Nigerian bank to this account. Funds appear instantly in your wallet.

### Paying with Wallet

1. Add items to cart
2. Go to checkout
3. Select **Wallet** as payment method
4. Complete order
5. Amount is deducted from wallet balance immediately

### Withdrawing Funds

1. Go to Profile > Wallet
2. Click **Withdraw**
3. Enter amount (minimum ₦100)
4. Enter bank details:
   - Account Number
   - Account Name
   - Bank Code (see list below)
5. Click **Withdraw**
6. Funds are transferred to your bank account

## Using Online Card Payment

### At Checkout

1. Add items to cart
2. Go to checkout
3. Select **Card Payment (Paystack)** as payment method
4. Complete order details
5. Click **Place Order**
6. You'll be redirected to Paystack payment page
7. Enter your card details:
   - Card Number
   - Expiry Date
   - CVV
   - Card PIN (if required)
8. Complete OTP verification (if required)
9. Payment is processed instantly
10. You'll be redirected back to the app

### Payment Confirmation

After successful payment:
- Order is automatically confirmed
- Payment status is updated to "completed"
- You'll see a success page with order details
- Order appears in "My Orders" section

### Failed Payment

If payment fails:
- You'll see an error message
- Order remains in pending state
- You can retry payment from order details
- No money is deducted from your account

## How It Works

### Wallet System Flow

1. **Create Wallet**
   - User clicks "Create Wallet"
   - `wallet-create-account` edge function is called
   - Paystack creates a customer and virtual account
   - Account details are saved to database

2. **Deposit**
   - User transfers money to virtual account
   - Paystack sends webhook notification
   - `wallet-webhook` edge function validates and processes
   - Wallet balance is updated instantly

3. **Payment**
   - User selects wallet at checkout
   - `wallet-payment` edge function is called
   - Balance is checked and deducted
   - Order payment status is updated

4. **Withdrawal**
   - User initiates withdrawal
   - `wallet-withdraw` edge function is called
   - Paystack creates transfer recipient and initiates transfer
   - Transaction is recorded

### Online Card Payment Flow

1. **Initialize Payment**
   - User selects card payment at checkout
   - Order is created in database
   - `paystack-initialize` edge function is called
   - Paystack returns payment URL

2. **Process Payment**
   - User is redirected to Paystack payment page
   - Enters card details and completes authentication
   - Paystack processes the payment

3. **Verify Payment**
   - After payment, user is redirected back
   - `paystack-verify` edge function is called
   - Payment status is verified with Paystack
   - Order payment status is updated

## Security Features

### Wallet System
- **Row Level Security (RLS)** - Users can only access their own wallet
- **JWT Verification** - All edge functions verify user authentication
- **Webhook Signature Validation** - Prevents fake deposit notifications
- **Balance Checks** - Prevents overdraft
- **Transaction Logging** - Complete audit trail

### Online Payment
- **PCI DSS Compliant** - Paystack handles all card data securely
- **3D Secure Authentication** - Additional verification for card transactions
- **Payment Verification** - Server-side verification of payment status
- **Transaction Reference Tracking** - Unique reference for each transaction

## Common Nigerian Bank Codes

Use these codes for wallet withdrawals:

| Bank Name | Code |
|-----------|------|
| Access Bank | 044 |
| GTBank | 058 |
| Zenith Bank | 057 |
| First Bank | 011 |
| UBA | 033 |
| Ecobank | 050 |
| Fidelity Bank | 070 |
| FCMB | 214 |
| Sterling Bank | 232 |
| Stanbic IBTC | 221 |
| Union Bank | 032 |
| Wema Bank | 035 |
| Polaris Bank | 076 |
| Kuda Bank | 50211 |

## Troubleshooting

### Wallet Issues

**Deposits Not Reflecting**
1. Verify webhook is configured correctly
2. Check transfer was to correct account number
3. View Paystack Dashboard > Logs > Webhooks
4. Wait 2-3 minutes for processing

**Withdrawal Failed**
1. Ensure correct bank code
2. Verify account number is 10 digits
3. Check sufficient wallet balance
4. Verify account name matches bank records

**Virtual Account Not Created**
1. Check Paystack API key is configured
2. Verify profile has email and name
3. Check edge function logs in Supabase
4. Ensure Paystack account is active

### Online Payment Issues

**Payment Page Not Loading**
1. Check internet connection
2. Verify Paystack API key is valid
3. Try again after a few moments
4. Contact support if issue persists

**Payment Declined**
1. Check card has sufficient funds
2. Verify card is enabled for online transactions
3. Contact your bank for card authorization
4. Try a different card

**Payment Successful But Order Not Updated**
1. Check order status in "My Orders"
2. Payment may still be processing
3. Wait 2-3 minutes for update
4. Contact support with payment reference

**Redirected Back Without Payment**
1. Payment was cancelled
2. Try checkout again
3. Complete payment process fully
4. Don't close browser before completion

## Testing

### Test in Sandbox Mode

Paystack provides test cards for development:

**Test Card Numbers:**
- Success: 5060666666666666666
- Failed: 1234567890123456
- Insufficient Funds: 5060666666666666667

**Test Details:**
- CVV: Any 3 digits
- Expiry: Any future date
- PIN: 1234
- OTP: 123456

### Going Live

1. Switch to Live API keys in Paystack Dashboard
2. Update edge function environment variables
3. Test with real card (small amount)
4. Monitor transactions in Paystack Dashboard
5. Set up email notifications

## Edge Functions

### Wallet Functions

- **wallet-create-account**: Creates virtual account
- **wallet-webhook**: Processes deposits
- **wallet-withdraw**: Handles withdrawals
- **wallet-payment**: Processes in-app payments

### Online Payment Functions

- **paystack-initialize**: Initiates card payment
- **paystack-verify**: Verifies payment completion

## Database Tables

### Wallets
- Stores user wallet information
- Virtual account details
- Current balance
- Paystack customer code

### Wallet Transactions
- Records all wallet transactions
- Tracks balance changes
- Stores payment references
- Links to orders

### Orders
- Stores order information
- Payment method and status
- Payment reference
- Transaction details

## Best Practices

1. **Always verify payment status** before fulfilling orders
2. **Monitor Paystack Dashboard** for transaction issues
3. **Keep webhook URL secure** and up to date
4. **Test thoroughly** before going live
5. **Provide clear instructions** to users
6. **Handle errors gracefully** with helpful messages
7. **Log all transactions** for audit purposes
8. **Set up email notifications** for failed payments

## Support

For issues or questions:

1. **Paystack Issues**: Contact Paystack support at support@paystack.com
2. **App Issues**: Check edge function logs in Supabase Dashboard
3. **Payment Disputes**: Use Paystack Dashboard > Disputes
4. **Technical Questions**: Check database tables for transaction records

## Additional Resources

- Paystack Documentation: https://paystack.com/docs
- Paystack API Reference: https://paystack.com/docs/api
- Paystack Dashboard: https://dashboard.paystack.com
- Test Cards: https://paystack.com/docs/payments/test-payments
