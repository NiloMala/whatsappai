import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Allow the common headers the client will send
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // Allow the methods used by this function
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  // If you want to allow credentials (cookies, authorization headers), set to true
  'Access-Control-Allow-Credentials': 'true',
  // Cache preflight for 1 day
  'Access-Control-Max-Age': '86400'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // Respond to preflight requests explicitly with 204 No Content and the CORS headers
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { action, instanceKey } = await req.json()
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    console.log('Evolution API URL:', evolutionApiUrl)
    console.log('Action:', action)

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API credentials not configured')
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': evolutionApiKey
    }

    if (action === 'create') {
      // Enforce per-plan instance limits server-side to avoid race conditions or bypasses
      try {
        // Get active user plan
        const { data: userPlanData, error: userPlanError } = await supabaseClient
          .from('user_plans')
          .select('plan_type')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        if (userPlanError) console.log('user_plans lookup error (non-fatal):', userPlanError)

        // Default: if no active plan found, fall back to 1 instance (assumption)
        let maxInstances: number | null = 1

        if (userPlanData && (userPlanData as any).plan_type) {
          const planType = (userPlanData as any).plan_type
          const { data: planRow, error: planError } = await supabaseClient
            .from('plans')
            .select('max_instances')
            .eq('plan_type', planType)
            .single()

          if (planError) {
            console.log('plans lookup error (non-fatal):', planError)
          } else if (planRow && (planRow as any).max_instances != null) {
            maxInstances = (planRow as any).max_instances
          }
        }

        // Count existing instances for the user
        const { count, error: countError } = await supabaseClient
          .from('whatsapp_connections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (countError) console.log('whatsapp_connections count error (non-fatal):', countError)

        // If we have a numeric maxInstances, enforce it
        if (typeof maxInstances === 'number' && count != null && count >= maxInstances) {
          console.log(`User ${user.id} reached plan limit: ${count}/${maxInstances}`)
          return new Response(
            JSON.stringify({ error: 'Plan limit reached', maxInstances }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }
      } catch (e) {
        console.log('Error while enforcing plan limits (non-fatal):', e)
      }

      // Generate unique instance name
      const instanceName = `instance_${user.id.substring(0, 8)}_${Date.now()}`
      
      console.log('Creating instance:', instanceName)

      // Create instance with webhook configured via Supabase
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`
      
      const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceName: instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          webhook: {
            url: webhookUrl,
            webhook_by_events: false,
            base64: true,
            events: [
              'MESSAGES_UPSERT'
            ]
          }
        })
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('Failed to create instance:', errorText)
        throw new Error(`Failed to create instance: ${errorText}`)
      }

      const instanceData = await createResponse.json()
      console.log('Instance created with webhook:', JSON.stringify(instanceData))

      // Extract instance-specific token from instanceData
      // Evolution API can return the token in different formats:
      // 1. hash as string: {"hash": "token123"}
      // 2. hash as object: {"hash": {"apikey": "token123"}}
      // 3. direct apikey: {"apikey": "token123"}
      let instanceToken = evolutionApiKey; // default fallback
      
      if (instanceData?.hash) {
        // If hash is a string, use it directly
        if (typeof instanceData.hash === 'string') {
          instanceToken = instanceData.hash;
        } 
        // If hash is an object with apikey, use it
        else if (instanceData.hash.apikey) {
          instanceToken = instanceData.hash.apikey;
        }
      } 
      // Fallback to other possible locations
      else if (instanceData?.instance?.apikey) {
        instanceToken = instanceData.instance.apikey;
      } 
      else if (instanceData?.apikey) {
        instanceToken = instanceData.apikey;
      }
      
      console.log('Instance token extracted:', {
        hashType: typeof instanceData?.hash,
        hashValue: instanceData?.hash,
        extractedToken: instanceToken,
        usingFallback: instanceToken === evolutionApiKey
      })

      // Connect to get QR code
      const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers
      })

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text()
        console.error('Failed to connect instance:', errorText)
        throw new Error(`Failed to connect instance: ${errorText}`)
      }

      const connectData = await connectResponse.json()
      console.log('Instance connected, QR code obtained')

      // Save to database - usar INSERT em vez de UPSERT para permitir múltiplas instâncias
      const { error: dbError } = await supabaseClient
        .from('whatsapp_connections')
        .insert({
          user_id: user.id,
          instance_key: instanceName,
          instance_token: instanceToken,
          qr_code: connectData.qrcode?.base64 || connectData.base64,
          status: 'pairing'
        })

      if (dbError) {
        console.error('Database error:', dbError)
        throw dbError
      }

      console.log('Instance created successfully, ready for webhook configuration via UI')

      return new Response(
        JSON.stringify({ success: true, instanceKey: instanceName }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'refreshQR') {
      console.log('Refreshing QR for instance:', instanceKey)

      const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceKey}`, {
        method: 'GET',
        headers
      })

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text()
        console.error('Failed to refresh QR:', errorText)
        
        // If instance doesn't exist (404), clean up database
        if (connectResponse.status === 404) {
          console.log('Instance not found, cleaning up database')
          await supabaseClient
            .from('whatsapp_connections')
            .delete()
            .eq('user_id', user.id)
            .eq('instance_key', instanceKey)
          
          return new Response(
            JSON.stringify({ 
              error: 'Instance not found. Please create a new instance.',
              instanceDeleted: true 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }
        
        throw new Error(`Failed to refresh QR: ${errorText}`)
      }

      const connectData = await connectResponse.json()

      const { error: dbError } = await supabaseClient
        .from('whatsapp_connections')
        .update({
          qr_code: connectData.qrcode?.base64 || connectData.base64,
          status: 'pairing'
        })
        .eq('user_id', user.id)
        .eq('instance_key', instanceKey)

      if (dbError) throw dbError

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'checkStatus') {
      console.log('Checking status for instance:', instanceKey)

      const statusResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceKey}`, {
        method: 'GET',
        headers
      })

      if (!statusResponse.ok) {
        console.error('Failed to check status')
        
        // If instance doesn't exist (404), clean up database
        if (statusResponse.status === 404) {
          console.log('Instance not found during status check, cleaning up database')
          await supabaseClient
            .from('whatsapp_connections')
            .delete()
            .eq('user_id', user.id)
            .eq('instance_key', instanceKey)
        }
        
        return new Response(
          JSON.stringify({ connected: false, instanceDeleted: statusResponse.status === 404 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const statusData = await statusResponse.json()
      console.log('Status data:', statusData)

      const isConnected = statusData.state === 'open' || statusData.instance?.state === 'open'
      console.log('Is connected:', isConnected)

      if (isConnected) {
        // Get instance details for phone number
        const fetchResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceKey}`, {
          method: 'GET',
          headers
        })

        let phoneNumber = null
        if (fetchResponse.ok) {
          const instances = await fetchResponse.json()
          const instance = instances.find((i: any) => i.instance?.instanceName === instanceKey)
          phoneNumber = instance?.instance?.owner || null
        }

        const { error: dbError } = await supabaseClient
          .from('whatsapp_connections')
          .update({
            status: 'connected',
            connected_at: new Date().toISOString(),
            qr_code: null,
            phone_number: phoneNumber
          })
          .eq('user_id', user.id)
          .eq('instance_key', instanceKey)

        if (dbError) {
          console.error('Error updating connected status:', dbError)
          throw dbError
        }
        
        console.log('Updated status to connected in database')
      } else {
        // Buscar status atual antes de atualizar
        const { data: currentConnection } = await supabaseClient
          .from('whatsapp_connections')
          .select('status, qr_code')
          .eq('user_id', user.id)
          .eq('instance_key', instanceKey)
          .single()

        // Se está em 'pairing', manter o QR code para que o usuário possa escanear
        // Só remove o QR code se já estava desconectado antes
        const shouldKeepQR = currentConnection?.status === 'pairing' && currentConnection?.qr_code
        
        const { error: dbError } = await supabaseClient
          .from('whatsapp_connections')
          .update({
            status: shouldKeepQR ? 'pairing' : 'disconnected',
            qr_code: shouldKeepQR ? currentConnection.qr_code : null,
            phone_number: null
          })
          .eq('user_id', user.id)
          .eq('instance_key', instanceKey)

        if (dbError) {
          console.error('Error updating disconnected status:', dbError)
          throw dbError
        }
        
        console.log(`Updated status to ${shouldKeepQR ? 'pairing (kept QR)' : 'disconnected'} in database`)
      }

      return new Response(
        JSON.stringify({ connected: isConnected }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'disconnect') {
      console.log('Disconnecting instance:', instanceKey)

      const logoutResponse = await fetch(`${evolutionApiUrl}/instance/logout/${instanceKey}`, {
        method: 'DELETE',
        headers
      })

      if (!logoutResponse.ok) {
        const errorText = await logoutResponse.text()
        console.error('Failed to logout:', errorText)
      }

      const { error: dbError } = await supabaseClient
        .from('whatsapp_connections')
        .update({
          status: 'disconnected',
          qr_code: null,
          phone_number: null
        })
        .eq('user_id', user.id)
        .eq('instance_key', instanceKey)

      if (dbError) throw dbError

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'delete') {
      console.log('Deleting instance:', instanceKey)

      // Delete from Evolution API
      const deleteResponse = await fetch(`${evolutionApiUrl}/instance/delete/${instanceKey}`, {
        method: 'DELETE',
        headers
      })

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const errorText = await deleteResponse.text()
        console.error('Failed to delete from Evolution API:', errorText)
        // Continue even if API delete fails
      }

      // Delete from database
      const { error: dbError } = await supabaseClient
        .from('whatsapp_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('instance_key', instanceKey)

      if (dbError) {
        console.error('Failed to delete from database:', dbError)
        throw dbError
      }

      console.log('Instance deleted successfully')

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})