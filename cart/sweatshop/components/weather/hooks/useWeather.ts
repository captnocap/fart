import { useMemo } from 'react';
import { useServiceKey } from '../../../lib/apis/useServiceKey';
import { useGeocode, useWeatherCurrent, useWeatherForecast } from '../../../lib/apis';
import type { WeatherLocation } from './useLocation';

export function useWeather(location: WeatherLocation) {
  const keys = useServiceKey('weather');
  const apiKey = (keys.apiKey || '').trim();
  const hasKey = !!apiKey;
  const options = useMemo(() => ({
    units: location.units,
    city: location.lat == null || location.lon == null ? location.city : undefined,
    lat: location.lat,
    lon: location.lon,
  }), [location.city, location.lat, location.lon, location.units]);

  const current = useWeatherCurrent(hasKey ? apiKey : null, options);
  const forecast = useWeatherForecast(hasKey ? apiKey : null, options);
  const geocode = useGeocode(hasKey ? apiKey : null, location.city ? location.city : null, { limit: 5 });

  const banner = !hasKey
    ? 'set weather API key in Settings > APIs'
    : current.error?.message || forecast.error?.message || geocode.error?.message || '';

  return { apiKey, hasKey, banner, current, forecast, geocode };
}
