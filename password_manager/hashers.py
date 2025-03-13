from django.contrib.auth.hashers import ScryptPasswordHasher
from django.contrib.auth.hashers import Argon2PasswordHasher


class MyScryptPasswordHasher(ScryptPasswordHasher):
    work_factor = 2**15
    block_size = 8
    parallelism = 1
    extra_margin = 1024 * 8
    maxmem = work_factor * 2 * block_size * 64 + extra_margin
    # max memory is 32 MiB when maxmem = 0. Min memory for above config is also 32MiB.
    # So just a little extra margin


class MyArgon2PasswordHasher(Argon2PasswordHasher):
    time_cost = 3
    memory_cost = 12 * 1024  # 12 MiB according to OWASP recommendations
    parallelism = 1
