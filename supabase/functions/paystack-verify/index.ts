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
    console.log('=== Paystack Verify Function Started ===');
    console.log('Request URL:', req.url);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');

    console.log('Payment Reference:', reference);

    if (!reference) {
      console.error('Missing payment reference');
      return new Response(
        JSON.stringify({ error: 'Missing payment reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching transaction from Paystack...');
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    console.log('Paystack response status:', paystackResponse.status);

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      console.error('Paystack error:', errorData);
      throw new Error(errorData.message || 'Failed to verify payment');
    }

    const paystackData = await paystackResponse.json();
    console.log('Paystack data received:', JSON.stringify(paystackData, null, 2));

    if (!paystackData.status || !paystackData.data) {
      console.error('Invalid Paystack response structure');
      throw new Error('Invalid response from Paystack');
    }

    const transaction = paystackData.data;
    console.log('Transaction status:', transaction.status);

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
            .countdown {
              font-size: 14px;
              color: #9ca3af;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Payment Failed</h1>
            <p>Your payment was not successful. Please try again.</p>
            <p>Transaction Status: ${transaction.status}</p>
            <a href="/" class="button">Return to App</a>
            <p class="countdown">Redirecting in <span id="countdown">5</span> seconds...</p>
          </div>
          <script>
            let seconds = 5;
            const countdownEl = document.getElementById('countdown');
            const interval = setInterval(() => {
              seconds--;
              if (countdownEl) countdownEl.textContent = seconds.toString();
              if (seconds <= 0) {
                clearInterval(interval);
                window.location.href = '/checkout';
              }
            }, 1000);
          </script>
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

    console.log('Order data from metadata:', orderData ? 'Found' : 'Missing');
    console.log('Order items from metadata:', orderItems ? `Found (${orderItems.length} items)` : 'Missing');

    if (!orderData || !orderItems) {
      console.error('Missing metadata - orderData:', !!orderData, 'orderItems:', !!orderItems);
      throw new Error('Order data not found in transaction metadata');
    }

    console.log('Fetching vendor information...');
    // Fetch vendor user_id
    const { data: vendor, error: vendorError } = await supabaseClient
      .from('profiles')
      .select('id, user_id')
      .eq('id', orderData.vendor_id)
      .single();

    if (vendorError || !vendor) {
      console.error('Vendor fetch error:', vendorError);
      throw new Error('Failed to fetch vendor information');
    }

    console.log('Vendor found:', vendor.id);
    console.log('Creating order in database...');

    const { data: newOrder, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        customer_id: orderData.customer_id,
        vendor_id: orderData.vendor_id,
        vendor_user_id: vendor.user_id,
        order_number: orderData.order_number,
        subtotal: orderData.subtotal,
        delivery_fee: orderData.delivery_fee,
        total: orderData.total,
        delivery_type: orderData.delivery_type,
        delivery_address: orderData.delivery_address,
        is_scheduled: orderData.is_scheduled,
        scheduled_delivery_time: orderData.scheduled_delivery_time,
        meal_time_preference: orderData.meal_time_preference,
        payment_method: orderData.payment_method,
        status: 'pending',
        payment_status: 'completed',
        payment_reference: reference,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw orderError;
    }

    console.log('Order created successfully:', {
      order_id: newOrder.id,
      order_number: newOrder.order_number,
      payment_status: newOrder.payment_status,
      customer_id: newOrder.customer_id
    });

    console.log('Inserting order items...');
    const orderItemsWithOrderId = orderItems.map((item: any) => ({
      ...item,
      order_id: newOrder.id,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      console.error('Order items insertion error:', itemsError);
      throw itemsError;
    }

    console.log('Order items inserted successfully - Count:', orderItemsWithOrderId.length);
    console.log('Clearing cart for customer:', orderData.customer_id);

    const { error: deleteCartError } = await supabaseClient
      .from('carts')
      .delete()
      .eq('user_id', orderData.customer_id);

    if (deleteCartError) {
      console.error('Failed to clear cart:', deleteCartError);
    } else {
      console.log('Cart cleared successfully for user:', orderData.customer_id);
    }

    console.log('=== Payment verification completed successfully ===');

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
            background: linear-gradient(135deg, #ff8c00 0%, #ff6b00 100%);
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
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: #dcfce7;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
          }
          h1 {
            color: #1f2937;
            margin: 0 0 16px;
            font-size: 28px;
          }
          p {
            color: #6b7280;
            margin: 0 0 24px;
            font-size: 16px;
            line-height: 1.5;
          }
          .order-number {
            background: #f3f4f6;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
          }
          .order-number strong {
            color: #ff8c00;
            font-size: 18px;
          }
          .button {
            display: inline-block;
            background: #ff8c00;
            color: white;
            padding: 16px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: background 0.2s;
          }
          .button:hover {
            background: #ff7700;
          }
          .message {
            color: #059669;
            font-size: 14px;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>Payment Successful!</h1>
          <p>Your payment has been processed successfully and your order has been created.</p>
          <div class="order-number">
            <strong>Order #${orderData.order_number}</strong>
          </div>
          <a href="/payment-success?reference=${reference}&order=${orderData.order_number}" class="button">View Order Details</a>
          <p class="message">You can close this window and return to the app to view your order.</p>
        </div>
        <script>
          // Auto redirect after 3 seconds
          setTimeout(() => {
            window.location.href = '/payment-success?reference=${reference}&order=${orderData.order_number}';
          }, 3000);
        </script>
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
