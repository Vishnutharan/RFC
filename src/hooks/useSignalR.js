import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { getHubUrl } from '../services/api';

export const useSignalR = (orderNumber, accessToken, onStatusUpdated) => {
  const connectionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!orderNumber) return undefined;

    let isActive = true;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(getHubUrl(), { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    connectionRef.current = connection;
    connection.on('OrderStatusUpdated', (payload) => {
      if (isActive) onStatusUpdated?.(payload);
    });

    connection
      .start()
      .then(() => connection.invoke('JoinOrderGroup', orderNumber, accessToken || null))
      .then(() => {
        if (isActive) setIsConnected(true);
      })
      .catch(() => {
        if (isActive) setIsConnected(false);
      });

    return () => {
      isActive = false;
      setIsConnected(false);
      connection
        .invoke('LeaveOrderGroup', orderNumber)
        .catch(() => {})
        .finally(() => connection.stop().catch(() => {}));
    };
  }, [orderNumber, accessToken, onStatusUpdated]);

  return { isConnected };
};
