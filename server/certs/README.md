# AWS RDS CA bundle

`global-bundle.pem` is the AWS RDS commercial-region CA bundle, downloaded from
`https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`.

It is a public trust anchor, not a credential. Refresh it only from that HTTPS
endpoint, inspect its certificates, and update this file's recorded SHA-256 in
the same review. The bundle committed for this change has SHA-256:

`e5bb2084ccf45087bda1c9bffdea0eb15ee67f0b91646106e466714f9de3c7e3`

The API and worker Docker runtime images copy this bundle to
`/app/certs/global-bundle.pem`. ECS API, worker, and migrate task definitions
set `DATABASE_SSL_CA_PATH` to that path; the image itself intentionally does
not, so local Docker Compose keeps using its plaintext PostgreSQL service.
