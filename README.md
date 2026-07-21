These are the 2 files that were missing from your last commit.
Here's exactly what to do with each one, in your local project folder:
D:\Adeel HiveSocial\Clients\Gingin\gingin-prod


=====================================================================
FILE 1 — UPDATE (replace an existing file)
=====================================================================
Source file here:  1_UPDATE_this_file__prisma_schema.prisma
Goes to:            prisma\schema.prisma   (REPLACE the whole file)

Action:
  1. Open prisma\schema.prisma in your project
  2. Select all, delete
  3. Paste in the full contents of 1_UPDATE_this_file__prisma_schema.prisma
  4. Save


=====================================================================
FILE 2 — CREATE (brand new folder + file)
=====================================================================
Source file here:  2_CREATE_new_folder__migration.sql
Goes to:            prisma\migrations\20260721100000_add_sales_channel\migration.sql

Action (PowerShell):
  mkdir "prisma\migrations\20260721100000_add_sales_channel"

  Then create a new file inside that folder named exactly:
      migration.sql
  and paste in the full contents of 2_CREATE_new_folder__migration.sql


=====================================================================
AFTER BOTH FILES ARE IN PLACE
=====================================================================
Run, in order:

  cd "D:\Adeel HiveSocial\Clients\Gingin\gingin-prod"
  npx prisma generate
  npx prisma migrate dev

  git add prisma/
  git status
    -> confirm it shows prisma/schema.prisma (modified)
       and prisma/migrations/20260721100000_add_sales_channel/ (new)

  git commit -m "Add missing prisma schema and migration for channel field"
  git push

Then on the VPS:
  cd ~/tools/gingin-forcasting
  git pull
  bash deploy.sh