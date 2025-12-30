
export interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
}

// WMO Weather interpretation codes (WW)
export const getWeatherDescription = (code: number): { label: string; icon: string } => {
  switch (code) {
    case 0: return { label: 'Clear sky', icon: '☀️' };
    case 1: return { label: 'Mainly clear', icon: '🌤️' };
    case 2: return { label: 'Partly cloudy', icon: '⛅' };
    case 3: return { label: 'Overcast', icon: '☁️' };
    case 45: case 48: return { label: 'Fog', icon: 'Mz' };
    case 51: case 53: case 55: return { label: 'Drizzle', icon: 'Vm' };
    case 61: case 63: case 65: return { label: 'Rain', icon: '🌧️' };
    case 71: case 73: case 75: return { label: 'Snow', icon: '❄️' };
    case 95: case 96: case 99: return { label: 'Thunderstorm', icon: '⚡' };
    default: return { label: 'Unknown', icon: '🌈' };
  }
};

export async function fetchLocalWeather(): Promise<WeatherData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,is_day,weather_code,wind_speed_10m&temperature_unit=celsius`
          );
          
          if (!response.ok) throw new Error('Weather API failed');
          
          const data = await response.json();
          resolve({
            temperature: data.current.temperature_2m,
            weatherCode: data.current.weather_code,
            isDay: !!data.current.is_day,
            windSpeed: data.current.wind_speed_10m
          });
        } catch (e) {
          console.error("Weather fetch failed", e);
          resolve(null);
        }
      },
      (error) => {
        console.warn("Geolocation denied", error);
        resolve(null);
      }
    );
  });
}
