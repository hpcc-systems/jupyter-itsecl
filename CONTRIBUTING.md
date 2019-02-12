# Contributing to ITSECL

First of all, thank you for taking the time to contribute.

Here, you will find relevant information for contributing to this project.

## Issue tracker

Please, feel free to use the [issue
tracker](https://github.com/hpcc-systems/itsecl/issues) or [JIRA
tracker](https://track.hpccsystems.com/projects/HPCC/issues) to report any
problems you encounter or any enhancements you would like to see implemented.
To facilitate the process of fixing a problem, please, include the following
information in your report:

- ITSECl version. Please, run the command:

```sh
itsecl --version
```

- npm version:

```sh
npm version
```

- IPython/Jupyter version:

```sh
ipython --version
jupyter --version
```

- Operating system. In most modern linux distributions, it is enough to run:

```sh
lsb_release -sd
```

## Code contributions

- Please, open an issue in the [issue
  tracker](https://github.com/hpcc-systems/itsecl/issues) or [JIRA
  tracker](https://track.hpccsystems.com/projects/HPCC/issues) to report any problems.

- Pull requests will be distributed under the terms in the LICENSE file. Hence,
  before accepting any pull requests, it is important that the copyright holder
  of a pull request acknowledges their consent. To express this consent, please,
  ensure the AUTHORS file has been updated accordingly.

## Coding guidelines

- For the sake of readability, please, ensure the coding style of your pull
  requests is consistent with this project.
  You can check whether your code meets our convention by the following shell code.
  ```sh
  npm run lint
  ```

- The IPython protocol uses underscores (`_`) in their the naming convention (as
  recommended in [PEP8](https://www.python.org/dev/peps/pep-0008/)). For these
  names, I find more readable to keep the original naming (although, if possible
  limited to a local scope).
