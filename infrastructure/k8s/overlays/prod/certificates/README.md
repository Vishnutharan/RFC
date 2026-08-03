# Amazon RDS trust root

`rds-ca-rsa2048-g1.pem` is the public Amazon RDS eu-west-2 RSA-2048 G1 root selected by the production Terraform configuration.

- Source bundle: `https://truststore.pki.rds.amazonaws.com/eu-west-2/eu-west-2-bundle.pem`
- Retrieved: 2026-08-03
- Certificate SHA-256 fingerprint: `3455640af7798b30da9c6179b5e21e23d95dabb7873a12fec70b02092745f04e`
- Subject: `Amazon RDS eu-west-2 Root CA RSA2048 G1`
- Expiry: 2061-05-22T00:46:24Z

AWS recommends registering only the selected root CA in the application trust store so managed intermediate rotation continues to work. Before changing `ca_cert_identifier` in Terraform, download the current regional bundle from the official AWS trust-store URL, verify its fingerprint out of band, replace this root, and test a `VerifyFull` connection before rollout.
