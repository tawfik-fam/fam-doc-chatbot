#!/bin/bash

# Set the new username
new_username="tawfik-fam"

# Temporarily set the new username for the current script execution
git config --local user.name "$new_username"

# Add all modified files
git add .

# Prompt for a commit message to improve commit hygiene
read -p "Enter a descriptive commit message: " COMMIT_MESSAGE

# Check if commit message is empty to prevent empty commits
if [[ -z "$COMMIT_MESSAGE" ]]; then
  echo "Warning: Empty commit message. Consider adding a message."
fi

# Commit changes with the provided message (or an empty message if none was provided)
git commit -m "$COMMIT_MESSAGE"

# Push the changes to the remote repository
git push origin main

# Reset the user.name to its original value
git config --global user.name "tawfik-ghamian"

echo "change username to tawfik-fam then add new files then commit it and push it then return to tawfik-ghamian username."

read -p "press any key to finish"