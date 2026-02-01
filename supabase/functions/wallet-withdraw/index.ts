import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, bank_code, account_number, account_name } = await req.json();

    if (!amount || !bank_code || !account_number) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < 100) {
      return new Response(
        JSON.stringify({ error: 'Minimum withdrawal amount is ₦100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: wallet } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentBalance = parseFloat(wallet.balance);
    if (currentBalance < amount) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transferRecipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: account_name,
        account_number: account_number,
        bank_code: bank_code,
        currency: 'NGN',
      }),
    });

    if (!transferRecipientResponse.ok) {
      const errorData = await transferRecipientResponse.json();
      throw new Error(errorData.message || 'Failed to create transfer recipient');
    }

    const recipientData = await transferRecipientResponse.json();
    const recipientCode = recipientData.data.recipient_code;

    const transferResponse = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reason: 'Wallet withdrawal',
      }),
    });

    if (!transferResponse.ok) {
      const errorData = await transferResponse.json();
      throw new Error(errorData.message || 'Failed to initiate transfer');
    }

    const transferData = await transferResponse.json();
    const transferCode = transferData.data.transfer_code;
    const reference = transferData.data.reference;

    const balanceBefore = currentBalance;
    const balanceAfter = currentBalance - amount;

    const transactionReference = `WTH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { error: transactionError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: 'withdrawal',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'pending',
        reference: transactionReference,
        paystack_reference: reference,
        description: `Withdrawal to ${account_number}`,
        metadata: {
          bank_code: bank_code,
          account_number: account_number,
          account_name: account_name,
          transfer_code: transferCode,
        },
      });

    if (transactionError) throw transactionError;

    const { error: walletError } = await supabaseClient
      .from('wallets')
      .update({ balance: balanceAfter })
      .eq('id', wallet.id);

    if (walletError) throw walletError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Withdrawal initiated successfully',
        reference: transactionReference,
        transfer_code: transferCode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
