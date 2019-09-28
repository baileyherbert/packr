<?php

function packr_decode($encoded) {
    return base64_decode($encoded, true);
}
