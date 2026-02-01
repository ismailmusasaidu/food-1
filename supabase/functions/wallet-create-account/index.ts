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

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingWallet } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingWallet?.paystack_customer_code) {
      return new Response(
        JSON.stringify({
          success: true,
          wallet: existingWallet,
          message: 'Virtual account already exists'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paystackResponse = await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile.email,
        first_name: profile.full_name?.split(' ')[0] || 'Customer',
        last_name: profile.full_name?.split(' ').slice(1).join(' ') || '',
        phone: profile.phone || '',
      }),
    });

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      throw new Error(errorData.message || 'Failed to create Paystack customer');
    }

    const paystackData = await paystackResponse.json();
    const customerCode = paystackData.data.customer_code;

    const virtualAccountResponse = await fetch('https://api.paystack.co/dedicated_account', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerCode,
        preferred_bank: 'wema-bank',
      }),
    });

    if (!virtualAccountResponse.ok) {
      const errorData = await virtualAccountResponse.json();
      throw new Error(errorData.message || 'Failed to create virtual account');
    }

    const virtualAccountData = await virtualAccountResponse.json();
    const accountNumber = virtualAccountData.data.account_number;
    const bankName = virtualAccountData.data.bank.name;

    if (existingWallet) {
      const { data: updatedWallet, error: updateError } = await supabaseClient
        .from('wallets')
        .update({
          paystack_customer_code: customerCode,
          paystack_account_number: accountNumber,
          paystack_bank_name: bankName,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          wallet: updatedWallet,
          message: 'Virtual account created successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const { data: newWallet, error: insertError } = await supabaseClient
        .from('wallets')
        .insert({
          user_id: user.id,
          paystack_customer_code: customerCode,
          paystack_account_number: accountNumber,
          paystack_bank_name: bankName,
          balance: 0,
          currency: 'NGN',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          success: true,
          wallet: newWallet,
          message: 'Virtual account created successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
