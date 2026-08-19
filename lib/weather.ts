export type WeatherSnapshot = {
  temperature: number;
  high: number;
  low: number;
  icon: string;
};

function iconForWeatherCode(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code === 1 || code === 2) return isDay ? '🌤️' : '☁️';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
  if ([61, 63, 65, 66, 67].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
  if ([80, 81, 82].includes(code)) return '🌦️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌤️';
}

export async function fetchDenverWeather(): Promise<WeatherSnapshot> {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=39.7392&longitude=-104.9903&current=temperature_2m,is_day,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FDenver&forecast_days=1';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  const data = await response.json();
  return {
    temperature: Math.round(data.current.temperature_2m),
    high: Math.round(data.daily.temperature_2m_max[0]),
    low: Math.round(data.daily.temperature_2m_min[0]),
    icon: iconForWeatherCode(data.current.weather_code, Boolean(data.current.is_day)),
  };
}
