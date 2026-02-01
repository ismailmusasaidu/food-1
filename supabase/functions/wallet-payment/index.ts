import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    const { amount, description, order_data, order_items } = await req.json();

    if (!amount || !order_data || !order_items) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
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

    if (!wallet.is_active) {
      return new Response(
        JSON.stringify({ error: 'Wallet is inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentBalance = parseFloat(wallet.balance);
    if (currentBalance < amount) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient balance',
          current_balance: currentBalance,
          required_amount: amount,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const balanceBefore = currentBalance;
    const balanceAfter = currentBalance - amount;

    const transactionReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data: newOrder, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        ...order_data,
        status: 'pending',
        payment_status: 'completed',
        payment_reference: transactionReference,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItemsWithOrderId = order_items.map((item: any) => ({
      ...item,
      order_id: newOrder.id,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) throw itemsError;

    const { error: transactionError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: 'payment',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'completed',
        reference: transactionReference,
        description: description || `Payment for order #${order_data.order_number}`,
        metadata: {
          order_id: newOrder.id,
          order_number: order_data.order_number,
        },
        order_id: newOrder.id,
        completed_at: new Date().toISOString(),
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
        message: 'Payment processed successfully',
        reference: transactionReference,
        new_balance: balanceAfter,
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
