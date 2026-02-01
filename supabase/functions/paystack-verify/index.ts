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

    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');

    if (!reference) {
      return new Response(
        JSON.stringify({ error: 'Missing payment reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      throw new Error(errorData.message || 'Failed to verify payment');
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.status || !paystackData.data) {
      throw new Error('Invalid response from Paystack');
    }

    const transaction = paystackData.data;

    if (transaction.status !== 'success') {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Failed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 48px;
              border-radius: 16px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .icon {
              width: 64px;
              height: 64px;
              margin: 0 auto 24px;
              background: #fee2e2;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
            }
            h1 {
              color: #1f2937;
              margin: 0 0 16px;
            }
            p {
              color: #6b7280;
              margin: 0 0 24px;
            }
            .button {
              display: inline-block;
              background: #ef4444;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Payment Failed</h1>
            <p>Your payment was not successful. Please try again.</p>
            <a href="/" class="button">Return to App</a>
          </div>
        </body>
        </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }

    const orderData = transaction.metadata?.order_data;
    const orderItems = transaction.metadata?.order_items;

    if (!orderData || !orderItems) {
      throw new Error('Order data not found in transaction metadata');
    }

    const { data: newOrder, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        ...orderData,
        status: 'pending',
        payment_status: 'completed',
        payment_reference: reference,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItemsWithOrderId = orderItems.map((item: any) => ({
      ...item,
      order_id: newOrder.id,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) throw itemsError;

    const { error: deleteCartError } = await supabaseClient
      .from('carts')
      .delete()
      .eq('user_id', orderData.customer_id);

    if (deleteCartError) console.error('Failed to clear cart:', deleteCartError);

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 48px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            background: #d1fae5;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
          }
          h1 {
            color: #1f2937;
            margin: 0 0 16px;
          }
          p {
            color: #6b7280;
            margin: 0 0 24px;
          }
          .amount {
            font-size: 32px;
            font-weight: bold;
            color: #10b981;
            margin: 16px 0;
          }
          .button {
            display: inline-block;
            background: #ff8c00;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✓</div>
          <h1>Payment Successful!</h1>
          <p>Your payment has been confirmed.</p>
          <div class="amount">₦${(transaction.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <p>Order Number: ${transaction.metadata?.order_number || 'N/A'}</p>
          <a href="/" class="button">Return to App</a>
        </div>
      </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 48px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            background: #fee2e2;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
          }
          h1 {
            color: #1f2937;
            margin: 0 0 16px;
          }
          p {
            color: #6b7280;
            margin: 0 0 24px;
          }
          .button {
            display: inline-block;
            background: #ff8c00;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>Verification Error</h1>
          <p>There was an error verifying your payment. Please contact support.</p>
          <a href="/" class="button">Return to App</a>
        </div>
      </body>
      </html>
      `,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }
});
