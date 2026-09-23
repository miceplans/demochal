environment = "production"
vpc_cidr    = "10.43.0.0/16"

frontend_origin = "https://semochall.com,https://admin.semochall.com,https://biz.semochall.com,https://www.semochall.com"
api_domain_name = "prod-server.semochall.com"
hosted_zone_id  = "Z00809511PGTCDCNL8EQF"
grafana_iam_role_name = "GrafanaLabsCloudWatchIntegrationProduction"

alarm_email = ""

enable_runtime       = false
api_desired_count    = 0
worker_desired_count = 0

api_image    = ""
worker_image = ""
