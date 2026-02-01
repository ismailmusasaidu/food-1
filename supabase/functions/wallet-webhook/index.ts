import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Paystack-Signature',
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

    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();

    const hash = createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.success' && event.data.channel === 'dedicated_nuban') {
      const { data } = event;
      const amount = data.amount / 100;
      const reference = data.reference;
      const customerCode = data.customer.customer_code;

      const { data: wallet } = await supabaseClient
        .from('wallets')
        .select('*')
        .eq('paystack_customer_code', customerCode)
        .maybeSingle();

      if (!wallet) {
        return new Response(
          JSON.stringify({ error: 'Wallet not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: existingTransaction } = await supabaseClient
        .from('wallet_transactions')
        .select('id')
        .eq('paystack_reference', reference)
        .maybeSingle();

      if (existingTransaction) {
        return new Response(
          JSON.stringify({ message: 'Transaction already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const balanceBefore = parseFloat(wallet.balance);
      const balanceAfter = balanceBefore + amount;

      const transactionReference = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { error: transactionError } = await supabaseClient
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          user_id: wallet.user_id,
          type: 'deposit',
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          status: 'completed',
          reference: transactionReference,
          paystack_reference: reference,
          description: `Deposit via bank transfer`,
          metadata: {
            customer_code: customerCode,
            channel: data.channel,
          },
          completed_at: new Date().toISOString(),
        });

      if (transactionError) throw transactionError;

      const { error: walletError } = await supabaseClient
        .from('wallets')
        .update({ balance: balanceAfter })
        .eq('id', wallet.id);

      if (walletError) throw walletError;

      return new Response(
        JSON.stringify({ success: true, message: 'Deposit processed successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Event received' }),
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
