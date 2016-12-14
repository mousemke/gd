# How to contribute


##### (1.) Create branch for feature or an issue from the dev branch.

`git checkout -b branchName`

> *Are you working on a specific issue? Please add issue number to branch name. E.g. #23-branchName*


##### (2.) Make your changes

> all code should have passing tests using mocha, sinon, and enzyme. Istanbul should show that the changes are covered by the tests

##### (3.) Commit changes to own branch

`git commit -m "type: message"`

> *For commits, we use Angular commit conventions. Please add types to your commit message (feat, fix, docs, style, refactor, perf, test, chore) and split your commits into those types. You can find [more information here](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#-git-commit-guidelines).*


##### (4.) Tests pass - Travis is green

> All tests should pass.  After you push your branch you should get a notification whether or not the commit passed Travis CI.  [It must be green to continue](https://travis-ci.com/mousemke/gd/)


##### (5.) Send PR (PullRequest) against dev

> *Please do not merge by yourself. Ping one or (if it makes sense more) members of your team for review in* **>48h**.


##### (6.) Review

+ Review by **one** team member:
    - check out branch
    - test on your setup
    - If ok, merge locally and push.
    - If not, feedback in comments.


+ Review by **more than one** team member:
    - check out branch
    - test on your setup
    - If ok, write "tested and ok" in comments.
    - If ok and you are the last to test, merge locally and push.
    - If not, feedback in comments.


##### (7.) Delete branch

+ *Please do not forget to delete the branch after merging.*
    - delete branch in repository
    - delete branch locally

````js
git checkout dev
git branch -D branchName
git push origin :branchName
````

