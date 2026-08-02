# Order Tracking Note

Current customer tracking is an estimated delivery ETA from Google Distance Matrix. It is not live driver GPS tracking.

To add real live GPS later, build a driver mobile client that posts driver latitude and longitude at a fixed interval, store the latest point in a `DriverLocation` table or low-latency cache, and broadcast location updates to the existing SignalR order group after the order-access proof has been verified.
