# Manual Security Checks

Use these checks against a migrated database before go-live:

1. Place a guest order in browser A and record `orderNumber` plus the returned `accessToken` in local storage under `rfc_recent_orders`.
2. From browser B with no cookies and no token, request `GET /api/orders/{orderNumber}`. Expected: `403` and an `OrderReadDenied` audit row.
3. From browser B with no cookies and no token, request `PUT /api/orders/{orderNumber}/cancel` with a JSON reason. Expected: `403` and an `OrderCancelDenied` audit row.
4. From browser B, open a SignalR connection and invoke `JoinOrderGroup(orderNumber, null)`. Expected: no group join and an `OrderTrackingJoinDenied` audit row.
5. Repeat the read, cancel, and SignalR join from browser A or by passing header `X-Order-Access-Token: {accessToken}`. Expected: access is allowed while the token is unexpired.
6. Login as a different customer whose email does not match the order. Repeat read/cancel/join with no token. Expected: all blocked with audit rows.
7. Login as the actual customer email used on the order. Repeat read/cancel/join with no token. Expected: access is allowed by customer session ownership.
