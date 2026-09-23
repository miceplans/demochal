bucket         = "semochal-staging-tfstate"
key            = "staging/terraform.tfstate"
region         = "ap-northeast-2"
dynamodb_table = "semochal-staging-tfstate-lock"
encrypt        = true
