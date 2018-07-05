This directory contains resources used for testing purposes. They are
not part of the main project (source code for tests is in the src/test
directory).

__offering-list.txt__: List of offerings to use when testing the quality of the conversion.
Should contain all offerings currently present on the marketplace except invalid ones
(for instance, missing metadata), since those cannot be registered again when using
back and forth conversion.

__quality-config.json__: Alternate config.json file used when testing the quality of the conversion.

__thing-list.txt__: List of thing URIs to use when testing the scalability of the gateway.