# Wallet System Setup Guide

This guide explains how to set up and configure the wallet system with Paystack integration in your food delivery app.

## Overview

The wallet system provides:
- **Virtual Bank Accounts** via Paystack for instant deposits
- **Secure Withdrawals** to any Nigerian bank account
- **In-app Payments** for orders
- **Transaction History** tracking
- **Real-time Balance Updates**

## Prerequisites

1. A Paystack account (sign up at https://paystack.com)
2. Paystack Secret Key (found in your Paystack Dashboard under Settings > API Keys)
3. Your app deployed with Supabase Edge Functions

## Step 1: Configure Paystack Secret Key

The Paystack secret key is already configured automatically in your Supabase project. No manual configuration is needed.

## Step 2: Configure Paystack Webhook

To receive instant notifications when customers deposit money, you need to set up a webhook:

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

## Step 3: Test the Wallet System

### Create a Wallet

1. Log in to your app
2. Go to the Profile tab
3. You'll see a "Create Your Wallet" section
4. Click "Create Wallet"
5. A virtual bank account will be generated for you

### Make a Deposit

1. After creating your wallet, you'll see your virtual account details:
   - Bank Name (e.g., Wema Bank)
   - Account Number
   - Account Name

2. Transfer money to this account from any Nigerian bank
3. The funds will appear in your wallet instantly (via webhook)

### Make a Withdrawal

1. Click "Withdraw" in your wallet
2. Enter the amount (minimum ₦100)
3. Enter your bank details:
   - Account Number
   - Account Name
   - Bank Code (e.g., 057 for Zenith Bank)

4. Click "Withdraw"
5. The money will be sent to your bank account

### Pay for Orders with Wallet

1. Add items to your cart
2. Go to checkout
3. Select "Wallet" as the payment method
4. Complete your order
5. The amount will be deducted from your wallet balance

## How It Works

### Deposits
1. User creates a wallet (calls `wallet-create-account` edge function)
2. Paystack generates a dedicated virtual account
3. User transfers money to the virtual account
4. Paystack sends a webhook to `wallet-webhook` edge function
5. Webhook validates the request and credits the wallet
6. Balance is updated in real-time

### Withdrawals
1. User initiates withdrawal (calls `wallet-withdraw` edge function)
2. Edge function validates balance and creates transfer via Paystack
3. Paystack processes the transfer to user's bank account
4. Transaction is recorded with pending status
5. Webhook confirms when transfer completes

### Payments
1. User selects wallet payment at checkout
2. Order is created with payment_method='wallet'
3. `wallet-payment` edge function is called
4. Balance is checked and deducted
5. Payment transaction is recorded
6. Order payment_status is updated to 'completed'

## Security Features

- **Row Level Security (RLS)** ensures users can only access their own wallet
- **JWT Verification** on all edge functions
- **Webhook Signature Validation** prevents fake deposit notifications
- **Balance Checks** prevent overdraft
- **Transaction Logging** for audit trail

## Common Bank Codes

Here are some common Nigerian bank codes for withdrawals:

- Access Bank: 044
- GTBank: 058
- Zenith Bank: 057
- First Bank: 011
- UBA: 033
- Ecobank: 050
- Fidelity Bank: 070
- FCMB: 214
- Sterling Bank: 232
- Stanbic IBTC: 221
- Union Bank: 032
- Wema Bank: 035
- Polaris Bank: 076
- Kuda Bank: 50211

## Troubleshooting

### Deposits Not Reflecting

1. Check that the webhook is correctly configured
2. Verify the webhook URL is correct
3. Check Paystack Dashboard > Logs > Webhooks for errors
4. Ensure the transfer was made to the correct virtual account

### Withdrawal Failed

1. Verify the bank code is correct
2. Ensure account number is 10 digits (NUBAN format)
3. Check that wallet has sufficient balance
4. Verify account name matches the account number

### Virtual Account Not Created

1. Check Paystack API key is configured
2. Verify user profile has email and full name
3. Check edge function logs for errors
4. Ensure Paystack account is active

## Database Schema

The wallet system uses these tables:

### `wallets`
- Stores user wallet information
- Virtual account details from Paystack
- Current balance

### `wallet_transactions`
- Records all transactions (deposits, withdrawals, payments)
- Tracks balance changes
- Stores Paystack references

## Edge Functions

### `wallet-create-account`
- Creates Paystack customer
- Generates virtual bank account
- Initializes user wallet

### `wallet-webhook`
- Receives Paystack notifications
- Processes deposits
- Updates wallet balance

### `wallet-withdraw`
- Creates transfer recipient
- Initiates bank transfer
- Records withdrawal transaction

### `wallet-payment`
- Processes in-app payments
- Deducts from wallet balance
- Updates order payment status

## Support

For issues or questions:
1. Check the edge function logs in Supabase Dashboard
2. Review Paystack Dashboard for transaction status
3. Check database tables for transaction records
