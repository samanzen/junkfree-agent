#!/bin/bash
# 1) First create an EMPTY repo on GitHub named: junkfree-agent
#    (github.com -> New repository -> name it "junkfree-agent" -> Private or Public -> do NOT add a README)
# 2) Then run:  bash push-to-github.sh
git remote remove origin 2>/dev/null
git remote add origin https://github.com/samanzen/junkfree-agent.git
git branch -M main
git push -u origin main
# When prompted:  Username = samanzen  |  Password = your GitHub Personal Access Token
