import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Only POST requests are allowed",
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Read request body
    const body = await req.json();

    const {
      device_uid,
      surface_temp,
      ambient_temp,
      humidity,

      // GPS data
      latitude,
      longitude,
      altitude,
      satellites,
    } = body;

    // Check device UID
    if (!device_uid) {
      return new Response(
        JSON.stringify({
          error: "device_uid is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Supabase configuration
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Server configuration is missing",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Create Supabase client
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // Find the registered device
    const {
      data: device,
      error: deviceError,
    } = await supabase
      .from("devices")
      .select("id, device_uid, status")
      .eq("device_uid", device_uid)
      .maybeSingle();

    if (deviceError) {
      console.log("DEVICE ERROR:", deviceError);

      return new Response(
        JSON.stringify({
          error: "Failed to find device",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Device does not exist
    if (!device) {
      return new Response(
        JSON.stringify({
          error: "Device is not registered",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Insert sensor + GPS reading
    const {
      data: reading,
      error: readingError,
    } = await supabase
      .from("sensor_data")
      .insert({
        device_id: device.id,

        // Sensor data
        surface_temp,
        ambient_temp,
        humidity,

        // GPS data
        latitude,
        longitude,
        altitude,
        satellites,
      })
      .select()
      .single();

    if (readingError) {
      console.log("READING ERROR:", readingError);

      return new Response(
        JSON.stringify({
          error: "Failed to save sensor reading",
          details: readingError.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Mark device online
    await supabase
      .from("devices")
      .update({
        status: "online",
      })
      .eq("id", device.id);

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        device_uid: device.device_uid,
        reading,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.log("FUNCTION ERROR:", error);

    return new Response(
      JSON.stringify({
        error: "Invalid request",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});