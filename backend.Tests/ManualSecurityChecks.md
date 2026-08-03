# Manual Security Checks

Use these checks against a migrated database before go-live:

1. Place a guest order in browser A and record `orderNumber` plus the returned `accessToken`. The frontend should keep the token only in its dedicated session-storage token map, never in the recent-order summary or local storage.
2. From browser B with no cookies and no token, request `GET /api/orders/{orderNumber}`. Expected: `404` and an `OrderReadDenied` audit row. The response must not confirm that the order exists.
3. From browser B with no cookies and no token, request `PUT /api/orders/{orderNumber}/cancel` with a JSON reason. Expected: `404` and an `OrderCancelDenied` audit row.
4. From browser B, open a SignalR connection and invoke `JoinOrderGroup(orderNumber, null)`. Expected: no group join and an `OrderTrackingJoinDenied` audit row.
5. Repeat the read, cancel, and SignalR join from browser A or by passing header `X-Order-Access-Token: {accessToken}`. Expected: access is allowed while the token is unexpired.
6. Login as a different customer whose email does not match the order. Repeat read/cancel/join with no token. Expected: all blocked with audit rows.
7. Register or login with the email used on an unowned/legacy order. Repeat read/cancel/join with no token. Expected: access remains blocked; email alone is not ownership proof.
