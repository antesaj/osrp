# OSRP — Open Spaced Repetition Protocol

## Project Overview

OSRP is a protocol specification for exchanging spaced repetition data between clients and servers.

- **Clients** are information providers — reader apps, podcast apps, or any application where a user might encounter information worth remembering. Clients capture content and send it to an SRS server.
- **Servers** are SRS (Spaced Repetition System) backends responsible for card creation, scheduling, review sessions, and long-term retention management.

The protocol defines how clients submit content for review and how servers manage the lifecycle of spaced repetition cards.
