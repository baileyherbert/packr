<?php

function packr_decode($encoded) {
    return gzinflate(base64_decode($encoded, true));
}
