# Service email (SES) sending identity for the notification email worker.
# Creating the identity and its DNS records is separate from turning delivery on
# (var.ses_from_email) so the domain can finish DKIM verification and the account
# can leave the SES sandbox before the worker sends anything.
# https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html
locals {
  ses_enabled = var.ses_domain != ""
}

data "aws_route53_zone" "ses" {
  count   = local.ses_enabled ? 1 : 0
  zone_id = var.hosted_zone_id
}

resource "aws_sesv2_email_identity" "service" {
  count                  = local.ses_enabled ? 1 : 0
  email_identity         = var.ses_domain
  configuration_set_name = var.ses_configuration_set_name

  # Easy DKIM: SES generates the key pair and publishes three selector tokens.
  # https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim-easy.html
  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }

  lifecycle {
    precondition {
      condition = (
        var.ses_domain == trimsuffix(data.aws_route53_zone.ses[0].name, ".") ||
        endswith(var.ses_domain, ".${trimsuffix(data.aws_route53_zone.ses[0].name, ".")}")
      )
      error_message = "ses_domain must be inside the hosted_zone_id zone so its DKIM/SPF/DMARC records can be created there."
    }
  }
}

resource "aws_route53_record" "ses_dkim" {
  count   = local.ses_enabled ? 3 : 0
  zone_id = var.hosted_zone_id
  name    = "${aws_sesv2_email_identity.service[0].dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.ses_domain}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.service[0].dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# Custom MAIL FROM subdomain so the SPF check aligns with the From domain for DMARC.
# https://docs.aws.amazon.com/ses/latest/dg/mail-from.html
resource "aws_sesv2_email_identity_mail_from_attributes" "service" {
  count                  = local.ses_enabled ? 1 : 0
  email_identity         = aws_sesv2_email_identity.service[0].email_identity
  mail_from_domain       = "mail.${var.ses_domain}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  count   = local.ses_enabled ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = aws_sesv2_email_identity_mail_from_attributes.service[0].mail_from_domain
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  count   = local.ses_enabled ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = aws_sesv2_email_identity_mail_from_attributes.service[0].mail_from_domain
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}

# https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dmarc.html
resource "aws_route53_record" "ses_dmarc" {
  count   = local.ses_enabled ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = "_dmarc.${var.ses_domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=${var.ses_dmarc_policy}"]
}
