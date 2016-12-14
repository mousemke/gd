
![gdn23](https://cloud.githubusercontent.com/assets/1480168/21179475/92ec4db2-c1f4-11e6-8c5a-bd74d2f615b2.JPG)

## Automated Google Drive Backup


### How to setup the project ###

Tested for node `6.3.1` and npm `3.10.5`

````bash
# clone project
git@github.com:mousemke/gd.git

# go into folder
cd gd

# install the npm modules
npm i

# edit config.js and add your account info.  In whatever editor you like

# run tests
npm test

// start server
npm run serve

````


Scripts
=======

| npm scripts | description
| --- | :---
| `npm run serve` 	| starts the dev server at http://localhost:8007
| `npm run deploy`  | runs the production webpack and sets the env
| `npm run lint`    | runs eslint for code and code style issues
| `npm run lintFix` | runs eslint for code and code style issues, fixes minor issues
| `npm test`     	| runs only linters (for now)



### Issues ###
Please [report issues here](https://github.com/mousemke/gd/issues).

##### (1.) add any specific information that can help to reproduce and resolve the bug.

- What did you do, when the bug appeared.
- Node, NPM, <module> + version number
- OS

##### (2.) Add a label to the issue, if possible.

- critical -> needs fix right away (like broken build, blocks development)
- bug -> needs fix
- issue -> small bug, does not affect anything (small bug in UI, design issue)
- feature -> feature request
- question -> needs discussion
- docs -> needs documentation
- help wanted -> need help with implementation or fixing bug


### Contributing ###

Branch structure:

`master` - latest stable git repo. Auto deploys to live (when applicable)

`stage` - stable git repo release candidate. no dist files commited. auto deploys to stage (when applicable)

`dev` - current development branch. This is where feature branches should branch from

feature branches - these branches come from dev, are branched for a specific geature or bug, then get merged back into dev

[Check here for more detailed instructions](https://github.com/mousemke/gd/blob/master/CONTRIBUTE.md)


##### Thank you <3

This project adheres to the [Contributor Covenant](http://contributor-covenant.org/). By participating, you are expected to honor this code.

[GD - Code of Conduct](https://github.com/mousemke/gd/blob/master/CODE_OF_CONDUCT.md)


### Change log:


## 1.1.0

+ initial commit

