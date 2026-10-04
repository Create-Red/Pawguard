const SUPABASE_URL =
  'https://dqedgxuyoyoivizugbnd.supabase.co';

const SUPABASE_FUNCTION =
  `${SUPABASE_URL}/functions/v1/device-data`;

const PUBLISHABLE_KEY =
  'sb_publishable_nAVO7VQCETsUxH8TdmZGjQ_TJN4yba_';

const DEVICE_UID =
  'PG-SIM-960481';


// Starting values
let surfaceTemp = 38.5;
let ambientTemp = 29.5;
let humidity = 63;
let battery = 100;


// Generate a small realistic change
function fluctuate(value, amount) {
  return value + (Math.random() * amount * 2 - amount);
}


// Generate sensor readings
function generateReading() {
  surfaceTemp = fluctuate(surfaceTemp, 0.3);
  ambientTemp = fluctuate(ambientTemp, 0.2);
  humidity = fluctuate(humidity, 1.5);

  // Keep values within realistic ranges
  surfaceTemp = Math.max(
    35,
    Math.min(41, surfaceTemp)
  );

  ambientTemp = Math.max(
    25,
    Math.min(35, ambientTemp)
  );

  humidity = Math.max(
    40,
    Math.min(85, humidity)
  );

  return {
    device_uid: DEVICE_UID,

    surface_temp: Number(
      surfaceTemp.toFixed(2)
    ),

    ambient_temp: Number(
      ambientTemp.toFixed(2)
    ),

    humidity: Number(
      humidity.toFixed(2)
    ),
  };
}


// Send reading to Supabase
async function sendReading() {
  const reading = generateReading();

  console.log('\n----------------------------');

  console.log(
    '🐕 PawGuard Device Simulator'
  );

  console.log(
    'Device:',
    DEVICE_UID
  );

  console.log(
    'Surface:',
    reading.surface_temp,
    '°C'
  );

  console.log(
    'Ambient:',
    reading.ambient_temp,
    '°C'
  );

  console.log(
    'Humidity:',
    reading.humidity,
    '%'
  );

  try {
    const response = await fetch(
      SUPABASE_FUNCTION,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'apikey':
            PUBLISHABLE_KEY,
        },

        body: JSON.stringify(
          reading
        ),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.log(
        '❌ Server error:',
        data
      );

      return;
    }

    console.log(
      '✅ Reading uploaded'
    );

    console.log(
      data
    );

    // Simulate battery drain
    battery -= 0.05;

    console.log(
      '🔋 Battery:',
      battery.toFixed(2),
      '%'
    );

  } catch (error) {

    console.log(
      '❌ Connection error:',
      error.message
    );
  }
}


// Start simulator
console.log(
  '================================'
);

console.log(
  '🐾 PAWGUARD DEVICE SIMULATOR'
);

console.log(
  '================================'
);

console.log(
  'Device:',
  DEVICE_UID
);

console.log(
  'Sending readings every 5 seconds...'
);


// Send immediately
sendReading();


// Send every 5 seconds
setInterval(
  sendReading,
  5000
);